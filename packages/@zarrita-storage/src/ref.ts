import { parse } from "reference-spec-reader";
import type { FetchStoreOptions } from "./fetch.js";
import FetchStore from "./fetch.js";
import type { AbsolutePath, AsyncReadable, RangeQuery } from "./types.js";
import { resolveUri } from "./util.js";

/**
 * Decode base64 to bytes. Uses Uint8Array.fromBase64 when available (ES2025),
 * falls back to a custom decoder from esbuild.
 * https://github.com/evanw/esbuild/blob/150a01844d47127c007c2b1973158d69c560ca21/internal/runtime/runtime.go#L185
 */
const toBinary: (base64: string) => Uint8Array<ArrayBuffer> =
	typeof Uint8Array.fromBase64 === "function"
		? (s: string) => Uint8Array.fromBase64(s)
		: (() => {
				let table = new Uint8Array(128);
				for (let i = 0; i < 64; i++) {
					table[
						i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i * 4 - 205
					] = i;
				}
				return (base64: string) => {
					const n = base64.length;
					const bytes = new Uint8Array(
						// @ts-expect-error
						(((n - (base64[n - 1] === "=") - (base64[n - 2] === "=")) * 3) /
							4) |
							0,
					);
					for (let i = 0, j = 0; i < n; ) {
						const c0 = table[base64.charCodeAt(i++)];
						const c1 = table[base64.charCodeAt(i++)];
						const c2 = table[base64.charCodeAt(i++)];
						const c3 = table[base64.charCodeAt(i++)];
						bytes[j++] = (c0 << 2) | (c1 >> 4);
						bytes[j++] = (c1 << 4) | (c2 >> 2);
						bytes[j++] = (c2 << 6) | c3;
					}
					return bytes;
				};
			})();

/** A resolved reference entry — base64 strings are decoded upfront. */
type ResolvedEntry =
	| Uint8Array<ArrayBuffer>
	| string
	| [url: string | null]
	| [url: string | null, offset: number, length: number];

interface ReferenceStoreOptions {
	target?: string | URL;
	/**
	 * A custom fetch handler, same as {@link FetchStoreOptions.fetch}.
	 * Covers both the spec load (via {@link ReferenceStore.fromUrl}) and
	 * all chunk fetches.
	 */
	fetch?: FetchStoreOptions["fetch"];
	/**
	 * @deprecated Prefer providing a custom {@link ReferenceStoreOptions.fetch}.
	 */
	overrides?: RequestInit;
}

/**
 * Compose a caller's Range header with a reference entry's byte window.
 *
 * The incoming range (from FetchStore's getRange) is relative to the key's
 * logical data. The entry's offset/length is relative to the remote file.
 */
function composeRange(
	range: string | null,
	offset: number,
	length: number,
): string {
	const end = offset + length;
	let start: number;
	let stop: number;

	if (!range) {
		start = offset;
		stop = end - 1;
	} else if (range.startsWith("bytes=-")) {
		const n = Number.parseInt(range.slice(7), 10);
		start = end - Math.min(n, length);
		stop = end - 1;
	} else {
		const [s, e] = range.slice(6).split("-").map(Number);
		start = offset + s;
		stop = Math.min(offset + e, end - 1);
	}

	if (start < offset || start > stop) {
		throw new Error(
			`Range out of bounds: requested ${range} for entry at offset=${offset}, length=${length}`,
		);
	}

	return `bytes=${start}-${stop}`;
}

/** Default fetch that translates `s3://` and `gc://` URIs to HTTPS. */
function defaultFetch(request: Request): Promise<Response> {
	const href = resolveUri(request.url);
	if (href !== request.url) {
		return fetch(new Request(href, request));
	}
	return fetch(request);
}

/**
 * Decode base64 entries upfront into Uint8Array. Saves ~2.5x memory
 * (base64 string as UTF-16 vs raw bytes) and avoids decoding on every access.
 */
function parseReferencesJson(refsJson: unknown): Map<string, ResolvedEntry> {
	// @ts-expect-error - TS doesn't like the type of `parse`
	const refs = parse(refsJson);
	const resolved = new Map<string, ResolvedEntry>();
	for (const [key, ref] of refs) {
		if (typeof ref === "string" && ref.startsWith("base64:")) {
			resolved.set(key, toBinary(ref.slice(7)));
		} else {
			resolved.set(key, ref);
		}
	}
	return resolved;
}

/**
 * A store backed by a
 * [kerchunk reference spec](https://fsspec.github.io/kerchunk/spec.html),
 * enabling random access to data in monolithic files (HDF5, TIFF, etc.)
 * that have been mapped to Zarr.
 *
 * Uses {@link FetchStore} internally. The default fetch handler translates
 * cloud-storage URIs (`s3://`, `gs://`, `gcs://`) to HTTPS via
 * {@link ReferenceStore.resolveUri}. Inline entries (plain strings and
 * base64) are served directly without making any network requests.
 *
 * @example Basic usage
 * ```ts
 * const store = await ReferenceStore.fromUrl("https://example.com/refs.json");
 * const arr = await zarr.open(store);
 * ```
 *
 * @example Custom fetch with auth
 * ```ts
 * const store = await ReferenceStore.fromUrl("https://example.com/refs.json", {
 *   async fetch(request) {
 *     const url = ReferenceStore.resolveUri(request.url);
 *     const req = new Request(url, request);
 *     req.headers.set("Authorization", `Bearer ${await getToken()}`);
 *     return fetch(req);
 *   },
 * });
 * ```
 *
 * @example Opt out of default URI translation
 * ```ts
 * const store = await ReferenceStore.fromUrl("https://example.com/refs.json", {
 *   fetch: (request) => fetch(request),
 * });
 * ```
 *
 * @experimental
 */
class ReferenceStore implements AsyncReadable<RequestInit> {
	#inner: FetchStore;

	constructor(
		refs: Map<string, ResolvedEntry>,
		opts: ReferenceStoreOptions = {},
	) {
		const target = opts.target;
		const fetchFn = opts.fetch ?? defaultFetch;

		this.#inner = new FetchStore(target ?? "https://ref.invalid", {
			overrides: opts.overrides,
			async fetch(request) {
				const key = new URL(request.url).pathname.slice(1);
				const ref = refs.get(key);

				if (!ref) {
					return new Response(null, { status: 404 });
				}

				if (ref instanceof Uint8Array) {
					return new Response(ref, { status: 200 });
				}

				if (typeof ref === "string") {
					return new Response(ref);
				}

				const [url, offset, length] = ref;
				const resolved = url ?? target;
				if (!resolved) {
					return new Response(null, { status: 404 });
				}

				const newRequest = new Request(String(resolved), request);
				const range = composeRange(
					request.headers.get("Range"),
					offset ?? 0,
					length ?? 0,
				);
				newRequest.headers.set("Range", range);
				return fetchFn(newRequest);
			},
		});
	}

	get(key: AbsolutePath, opts?: RequestInit): Promise<Uint8Array | undefined> {
		return this.#inner.get(key, opts);
	}

	getRange(
		key: AbsolutePath,
		range: RangeQuery,
		opts?: RequestInit,
	): Promise<Uint8Array | undefined> {
		return this.#inner.getRange(key, range, opts);
	}

	/**
	 * Translate `s3://` and `gc://` URIs to HTTPS URLs.
	 * Useful when writing a custom `fetch` handler for reference stores
	 * whose entries contain cloud-specific URIs.
	 */
	static resolveUri = resolveUri;

	static fromSpec(
		spec: Record<string, unknown>,
		opts?: ReferenceStoreOptions,
	): ReferenceStore;
	static fromSpec(
		spec: Promise<Record<string, unknown>>,
		opts?: ReferenceStoreOptions,
	): Promise<ReferenceStore>;
	static fromSpec(
		spec: Promise<Record<string, unknown>> | Record<string, unknown>,
		opts?: ReferenceStoreOptions,
	): ReferenceStore | Promise<ReferenceStore> {
		if (spec instanceof Promise) {
			return spec.then((s) => new ReferenceStore(parseReferencesJson(s), opts));
		}
		return new ReferenceStore(parseReferencesJson(spec), opts);
	}

	static async fromUrl(
		url: string | URL,
		opts: ReferenceStoreOptions = {},
	): Promise<ReferenceStore> {
		const fetchFn = opts.fetch ?? defaultFetch;
		const resp = await fetchFn(new Request(url));
		const refs = parseReferencesJson(await resp.json());
		return new ReferenceStore(refs, opts);
	}
}

export default ReferenceStore;
