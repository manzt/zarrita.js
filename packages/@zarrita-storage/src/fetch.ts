import type { AbsolutePath, AsyncReadable, RangeQuery } from "./types.js";
import { mergeInit } from "./util.js";

function resolve(root: string | URL, path: AbsolutePath): URL {
	const base = typeof root === "string" ? new URL(root) : root;
	if (!base.pathname.endsWith("/")) {
		// ensure trailing slash so that base is resolved as _directory_
		base.pathname += "/";
	}
	const resolved = new URL(path.slice(1), base);
	// copy search params to new URL
	resolved.search = base.search;
	return resolved;
}

async function handleResponse(
	response: Response,
): Promise<Uint8Array | undefined> {
	if (response.status === 404) {
		return undefined;
	}
	if (response.status === 200 || response.status === 206) {
		return new Uint8Array(await response.arrayBuffer());
	}
	throw new Error(
		`Unexpected response status ${response.status} ${response.statusText}`,
	);
}

/**
 * Read a 200 response to a range request without buffering the whole file.
 *
 * A 200 is either the whole file, from a server that ignored `Range`, or the
 * exact bytes, from a custom `fetch`. Reading stops just past the requested
 * length, so the first case throws and the second returns the bytes.
 */
async function readRangeFrom200(
	response: Response,
	range: RangeQuery,
): Promise<Uint8Array> {
	let limit = "suffixLength" in range ? range.suffixLength : range.length;
	let declared = parseContentLength(response.headers.get("Content-Length"));
	if (declared !== undefined && declared > limit) {
		await response.body?.cancel();
		throw ignoredRangeError(response);
	}
	if (!response.body) {
		return new Uint8Array(0);
	}
	let reader = response.body.getReader();
	let chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		let result = await reader.read();
		if (result.done) break;
		total += result.value.length;
		if (total > limit) {
			await reader.cancel();
			throw ignoredRangeError(response);
		}
		chunks.push(result.value);
	}
	let bytes = new Uint8Array(total);
	let offset = 0;
	for (let chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return bytes;
}

function ignoredRangeError(response: Response): Error {
	return new Error(
		`Server ignored the Range header for ${response.url} and sent the whole file. ` +
			"Range reads need a server that answers with 206 Partial Content.",
	);
}

function parseContentLength(value: string | null): number | undefined {
	if (value === null || !/^\d+$/.test(value.trim())) {
		return undefined;
	}
	let length = Number(value);
	return length > 0 ? length : undefined;
}

/** Options for configuring a {@link FetchStore}. */
interface FetchStoreOptions {
	/**
	 * A custom fetch handler to intercept requests.
	 *
	 * Receives a standard {@link https://github.com/nicolo-ribaudo/tc55-proposal-functions-api | WinterTC fetch handler},
	 * similar to Cloudflare Workers, Deno.serve, and Bun.serve.
	 *
	 * Receives a {@link Request} object and must return a {@link Response}.
	 * The response is handled by the store as follows:
	 *
	 * - **404** — treated as a missing key (`undefined`)
	 * - **200 / 206** — treated as success, body is read as bytes
	 * - **Any other status** — throws an error
	 *
	 * Use this to add authentication, presign URLs, transform requests,
	 * or remap error codes for backends that don't follow the conventions
	 * above.
	 *
	 * **Important:** Sharding and partial reads rely on `Range` headers.
	 * When transforming a request (e.g., changing the URL), use
	 * `new Request(newUrl, originalRequest)` to preserve headers, abort
	 * signals, and other options passed via `store.get(key, init)`.
	 *
	 * @example Presign URLs
	 * ```ts
	 * const store = new FetchStore("https://my-bucket.s3.amazonaws.com/data.zarr", {
	 *   async fetch(request) {
	 *     const newUrl = await presign(request.url);
	 *     // Preserves headers, abort signal, and other options from store.get(key, init)
	 *     return fetch(new Request(newUrl, request));
	 *   },
	 * });
	 * ```
	 *
	 * @example Handle S3 403 as missing key
	 *
	 * S3 returns 403 (not 404) for missing keys on private buckets,
	 * which causes the store to throw. If you know that 403 means
	 * "not found" in your setup, remap it:
	 *
	 * ```ts
	 * const store = new FetchStore("https://my-bucket.s3.amazonaws.com/data.zarr", {
	 *   async fetch(request) {
	 *     const response = await fetch(request);
	 *     if (response.status === 403) {
	 *       return new Response(null, { status: 404 });
	 *     }
	 *     return response;
	 *   },
	 * });
	 * ```
	 */
	fetch?: (request: Request) => Promise<Response>;
	/**
	 * Default {@link RequestInit} options applied to every request.
	 *
	 * @deprecated Prefer implementing a custom {@link FetchStoreOptions.fetch}
	 * to intercept and modify requests.
	 */
	overrides?: RequestInit;
	/** Whether to use suffix-length range requests (e.g., `Range: bytes=-N`). */
	useSuffixRequest?: boolean;
}

/**
 * Readonly store backed by the
 * [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
 *
 * Works anywhere `fetch` is available: browsers, Node.js 18+, Deno, and Bun.
 *
 * ## Response handling
 *
 * The store interprets HTTP responses as follows:
 *
 * | Status | Meaning |
 * | ------ | ------- |
 * | **404** | Missing key — returns `undefined` |
 * | **200 / 206** | Success — body is read as `Uint8Array` |
 * | **Any other** | Throws an error |
 *
 * Range reads (`getRange`) need a server that answers with 206 Partial
 * Content. If a range request gets a 200 with more bytes than requested, the
 * server ignored `Range` and the read throws before downloading the file.
 *
 * If you need to remap status codes (e.g., S3 returns 403 for missing keys
 * on private buckets), provide a custom `fetch` implementation.
 *
 * @example Basic usage
 * ```ts
 * import { FetchStore } from "@zarrita/storage";
 *
 * const store = new FetchStore("http://localhost:8080/data.zarr");
 * ```
 *
 * @example Custom fetch with presigned URLs
 * ```ts
 * import { FetchStore } from "@zarrita/storage";
 *
 * const store = new FetchStore("https://my-bucket.s3.amazonaws.com/data.zarr", {
 *   async fetch(request) {
 *     const newUrl = await presign(request.url);
 *     // Preserves Range headers, abort signal, etc.
 *     return fetch(new Request(newUrl, request));
 *   },
 * });
 * ```
 */
class FetchStore implements AsyncReadable {
	#fetch: (request: Request) => Promise<Response>;
	#overrides: RequestInit;
	#useSuffixRequest: boolean;

	constructor(
		public url: string | URL,
		options: FetchStoreOptions = {},
	) {
		this.#fetch = options.fetch ?? ((request) => fetch(request));
		this.#overrides = options.overrides ?? {};
		this.#useSuffixRequest = options.useSuffixRequest ?? false;
	}

	#buildRequest(url: string | URL, init: RequestInit): Request {
		return new Request(url, mergeInit(this.#overrides, init));
	}

	async get(
		key: AbsolutePath,
		options: RequestInit = {},
	): Promise<Uint8Array | undefined> {
		let href = resolve(this.url, key).href;
		let request = this.#buildRequest(href, options);
		let response = await this.#fetch(request);
		return handleResponse(response);
	}

	async getRange(
		key: AbsolutePath,
		range: RangeQuery,
		options: RequestInit = {},
	): Promise<Uint8Array | undefined> {
		let url = resolve(this.url, key);
		let response: Response;
		if ("suffixLength" in range) {
			response = await this.#fetchSuffix(url, range.suffixLength, options);
		} else {
			let rangeInit: RequestInit = {
				...options,
				headers: {
					...options.headers,
					Range: `bytes=${range.offset}-${range.offset + range.length - 1}`,
				},
			};
			let request = this.#buildRequest(url, rangeInit);
			response = await this.#fetch(request);
		}
		if (response.status === 200) {
			return readRangeFrom200(response, range);
		}
		return handleResponse(response);
	}

	async #fetchSuffix(
		url: URL,
		suffixLength: number,
		options: RequestInit,
	): Promise<Response> {
		if (!this.#useSuffixRequest) {
			let headRequest = this.#buildRequest(url, {
				...options,
				method: "HEAD",
			});
			let response = await this.#fetch(headRequest);
			if (!response.ok) {
				return response;
			}
			let length = parseContentLength(response.headers.get("Content-Length"));
			if (length !== undefined) {
				let offset = Math.max(0, length - suffixLength);
				let rangeInit: RequestInit = {
					...options,
					headers: {
						...options.headers,
						Range: `bytes=${offset}-${length - 1}`,
					},
				};
				return this.#fetch(this.#buildRequest(url, rangeInit));
			}
			// No usable length (#432), so fall back to a suffix request.
		}
		let init: RequestInit = {
			...options,
			headers: { ...options.headers, Range: `bytes=-${suffixLength}` },
		};
		return this.#fetch(this.#buildRequest(url, init));
	}
}

export type { FetchStoreOptions };
export default FetchStore;
