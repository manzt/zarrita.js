import type { AbsolutePath, AsyncReadable, RangeQuery } from "./types.js";
import { fetch_range } from "./util.js";

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

/**
 * Readonly store based in the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).
 * Must polyfill `fetch` for use in Node.js.
 *
 * ```typescript
 * import * as zarr from "@zarrita/core";
 * const store = new FetchStore("http://localhost:8080/data.zarr");
 * const arr = await zarr.get(store, { kind: "array" });
 * ```
 */
class FetchStore implements AsyncReadable<RequestInit> {
	#overrides: RequestInit;

	constructor(
		public url: string | URL,
		options: { overrides?: RequestInit } = {},
	) {
		this.#overrides = options.overrides ?? {};
	}

	#merge_init(overrides: RequestInit) {
		return {
			...this.#overrides,
			...overrides,
			headers: {
				...this.#overrides.headers,
				...overrides.headers,
			},
		};
	}

	async get(
		key: AbsolutePath,
		options: RequestInit = {},
	): Promise<Uint8Array | undefined> {
		let href = resolve(this.url, key).href;
		let response = await fetch(href, this.#merge_init(options));
		if (response.status === 404 || response.status === 403) {
			return undefined;
		}
		return new Uint8Array(await response.arrayBuffer());
	}

	async getRange(
		key: AbsolutePath,
		range: RangeQuery,
		options: RequestInit = {},
	): Promise<Uint8Array | undefined> {
		let url = resolve(this.url, key);
		let init = this.#merge_init(options);
		let response: Response;
		if ("suffixLength" in range) {
			// TODO: option to support suffix request instead of two requests
			let head_response = await fetch(url, { ...init, method: "HEAD" });
			if (head_response.status === 404 || head_response.status === 403) {
				return undefined;
			}
			let length = Number(head_response.headers.get("Content-Length"));
			response = await fetch_range(url, length - range.suffixLength, length - 1, init);
		} else {
			response = await fetch_range(url, range.offset, range.length, init);
		}

		if (response.status === 404 || response.status === 403) {
			return undefined;
		}

		return new Uint8Array(await response.arrayBuffer());
	}
}

export default FetchStore;
