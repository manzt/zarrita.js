import type { Reader, ZipInfo } from "unzipit";
import { unzip } from "unzipit";
import type { AbsolutePath, AsyncReadable } from "./types.js";
import { assert, fetch_range, strip_prefix } from "./util.js";

export class BlobReader implements Reader {
	constructor(public blob: Blob) {}
	async getLength(): Promise<number> {
		return this.blob.size;
	}
	async read(offset: number, length: number): Promise<Uint8Array> {
		const blob = this.blob.slice(offset, offset + length);
		return new Uint8Array(await blob.arrayBuffer());
	}
}

/** Options for {@linkcode ZipFileStore}. */
interface ZipFileStoreOptions {
	/**
	 * Optional function to transform entries after unzipping.
	 *
	 * Useful for modifying or restructuring the paths of extracted zip entries.
	 */
	transformEntries?: (entries: ZipInfo["entries"]) => ZipInfo["entries"];
}

export class HTTPRangeReader implements Reader {
	private length?: number;
	#overrides: RequestInit;
	constructor(
		public url: string | URL,
		opts: { overrides?: RequestInit } = {},
	) {
		this.#overrides = opts.overrides ?? {};
	}

	async getLength(): Promise<number> {
		if (this.length === undefined) {
			const req = await fetch(this.url as string, {
				...this.#overrides,
				method: "HEAD",
			});
			assert(
				req.ok,
				`failed http request ${this.url}, status: ${req.status}: ${req.statusText}`,
			);
			this.length = Number(req.headers.get("content-length"));
			if (Number.isNaN(this.length)) {
				throw Error("could not get length");
			}
		}
		return this.length;
	}

	async read(offset: number, size: number): Promise<Uint8Array> {
		if (size === 0) {
			return new Uint8Array(0);
		}
		const req = await fetch_range(this.url, offset, size, this.#overrides);
		assert(
			req.ok,
			`failed http request ${this.url}, status: ${req.status} offset: ${offset} size: ${size}: ${req.statusText}`,
		);
		return new Uint8Array(await req.arrayBuffer());
	}
}

/** @experimental */
class ZipFileStore<R extends Reader = Reader> implements AsyncReadable {
	private info: Promise<ZipInfo>;
	constructor(reader: R, opts: ZipFileStoreOptions = {}) {
		this.info = unzip(reader).then((info) => {
			if (opts.transformEntries) {
				info.entries = opts.transformEntries(info.entries);
			}
			return info;
		});
	}

	async get(key: AbsolutePath): Promise<Uint8Array | undefined> {
		let entry = (await this.info).entries[strip_prefix(key)];
		if (!entry) return;
		return new Uint8Array(await entry.arrayBuffer());
	}

	async has(key: AbsolutePath): Promise<boolean> {
		return strip_prefix(key) in (await this.info).entries;
	}

	static fromUrl(
		href: string | URL,
		opts: { overrides?: RequestInit } & ZipFileStoreOptions = {},
	): ZipFileStore<HTTPRangeReader> {
		return new ZipFileStore(new HTTPRangeReader(href, opts), opts);
	}

	static fromBlob(
		blob: Blob,
		opts: ZipFileStoreOptions = {},
	): ZipFileStore<BlobReader> {
		return new ZipFileStore(new BlobReader(blob), opts);
	}
}

export default ZipFileStore;
