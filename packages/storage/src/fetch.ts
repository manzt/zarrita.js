import type { AbsolutePath, AsyncReadable, GetOptions } from "./types.js";
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

	async get(
		key: AbsolutePath,
		{ offset, length, ...overrides }: GetOptions<RequestInit> = {},
	): Promise<Uint8Array | undefined> {
		const href = resolve(this.url, key).href;
		const response = await fetch_range(href, offset, length, {
			...this.#overrides,
			...overrides,
			headers: {
				...this.#overrides.headers,
				...overrides.headers,
			},
		});
		if (response.status === 404 || response.status === 403) {
			return undefined;
		}
		const value = await response.arrayBuffer();
		return new Uint8Array(value);
	}
}

export default FetchStore;
