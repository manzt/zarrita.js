import type { AbsolutePath, AsyncReadable, RangeQuery } from "./types.js";
import { fetchRange, mergeInit } from "./util.js";

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

async function fetchSuffix(
	url: URL,
	suffixLength: number,
	init: RequestInit,
	useSuffixRequest: boolean,
): Promise<Response> {
	if (useSuffixRequest) {
		return fetch(url, {
			...init,
			headers: { ...init.headers, Range: `bytes=-${suffixLength}` },
		});
	}
	let response = await fetch(url, { ...init, method: "HEAD" });
	if (!response.ok) {
		// will be picked up by handleResponse
		return response;
	}
	let contentLength = response.headers.get("Content-Length");
	let length = Number(contentLength);
	return fetchRange(url, length - suffixLength, length, init);
}

/**
 * Readonly store based in the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
 * Must polyfill `fetch` for use in Node.js.
 *
 * ```typescript
 * import * as zarr from "zarrita";
 * const store = new FetchStore("http://localhost:8080/data.zarr");
 * const arr = await zarr.get(store, { kind: "array" });
 * ```
 */
class FetchStore implements AsyncReadable<RequestInit> {
	#overrides: RequestInit;
	#useSuffixRequest: boolean;

	constructor(
		public url: string | URL,
		options: { overrides?: RequestInit; useSuffixRequest?: boolean } = {},
	) {
		this.#overrides = options.overrides ?? {};
		this.#useSuffixRequest = options.useSuffixRequest ?? false;
	}

	#mergeInit(overrides: RequestInit) {
		return mergeInit(this.#overrides, overrides);
	}

	async get(
		key: AbsolutePath,
		options: RequestInit = {},
	): Promise<Uint8Array | undefined> {
		let href = resolve(this.url, key).href;
		let response = await fetch(href, this.#mergeInit(options));
		return handleResponse(response);
	}

	async getRange(
		key: AbsolutePath,
		range: RangeQuery,
		options: RequestInit = {},
	): Promise<Uint8Array | undefined> {
		let url = resolve(this.url, key);
		let init = this.#mergeInit(options);
		let response: Response;
		if ("suffixLength" in range) {
			response = await fetchSuffix(
				url,
				range.suffixLength,
				init,
				this.#useSuffixRequest,
			);
		} else {
			response = await fetchRange(url, range.offset, range.length, init);
		}
		return handleResponse(response);
	}
}

export default FetchStore;
