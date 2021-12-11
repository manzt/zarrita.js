import ReadOnlyStore from "./readonly";
import type { AbsolutePath } from "../types";

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

class FetchStore extends ReadOnlyStore<RequestInit> {
	constructor(public url: string | URL) {
		super();
	}

	async get(key: AbsolutePath, opts: RequestInit = {}): Promise<Uint8Array | undefined> {
		const { href } = resolve(this.url, key);
		const res = await fetch(href, opts);
		if (res.status === 404 || res.status === 403) {
			return undefined;
		}
		const value = await res.arrayBuffer();
		return new Uint8Array(value);
	}

	has(key: AbsolutePath): Promise<boolean> {
		// TODO: make parameter, use HEAD request if possible.
		return this.get(key).then((res) => res !== undefined);
	}
}

export default FetchStore;
