import ReadOnlyStore from "./readonly";

class FetchStore extends ReadOnlyStore<RequestInit> {
	href: string;

	constructor(url: URL)
	constructor(href: string)
	constructor(url: string | URL) {
		super();
		let href = typeof url === "string" ? url : url.href;
		this.href = href.endsWith("/") ? href.slice(0, -1) : href;
	}

	_path(key: string) {
		return `${this.href}/${key.startsWith("/") ? key.slice(1) : key}`;
	}

	async get(key: string, opts: RequestInit = {}): Promise<Uint8Array | undefined> {
		const path = this._path(key);
		const res = await fetch(path, opts);
		if (res.status === 404 || res.status === 403) {
			return undefined;
		}
		const value = await res.arrayBuffer();
		return new Uint8Array(value);
	}

	has(key: string): Promise<boolean> {
		return this.get(key).then((res) => res !== undefined);
	}
}

export default FetchStore;
