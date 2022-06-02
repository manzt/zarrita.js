import type { AbsolutePath, Async, Readable } from "../types";

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
 * import * as zarr from "zarrita/v2";
 * const store = new FetchStore("http://localhost:8080/data.zarr");
 * const arr = await zarr.get_array(store);
 * ```
 */
class FetchStore implements Async<Readable<RequestInit>> {
	constructor(public url: string | URL) {}

	async get(key: AbsolutePath, opts: RequestInit = {}) {
		const { href } = resolve(this.url, key);
		return fetch(href, opts);
	}

	has(key: AbsolutePath) {
		// TODO: make parameter, use HEAD request if possible.
		return this.get(key).then(res => res.ok);
	}
}

export default FetchStore;
