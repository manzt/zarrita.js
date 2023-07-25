import { unzip } from "unzipit";
import { fetch_range, strip_prefix } from "./util";

import type { Reader, ZipInfo } from "unzipit";
import type { AbsolutePath, Async, Readable } from "../types";

export class BlobReader implements Reader {
	constructor(public blob: Blob) {}
	async getLength() {
		return this.blob.size;
	}
	async read(offset: number, length: number) {
		const blob = this.blob.slice(offset, offset + length);
		return new Uint8Array(await blob.arrayBuffer());
	}
}

export class HTTPRangeReader implements Reader {
	private length?: number;
	constructor(public url: string | URL) {}

	async getLength() {
		if (this.length === undefined) {
			const req = await fetch(this.url as string, { method: "HEAD" });
			if (!req.ok) {
				throw new Error(
					`failed http request ${this.url}, status: ${req.status}: ${req.statusText}`,
				);
			}
			this.length = parseInt(req.headers.get("content-length")!);
			if (Number.isNaN(this.length)) {
				throw Error("could not get length");
			}
		}
		return this.length;
	}

	async read(offset: number, size: number) {
		if (size === 0) {
			return new Uint8Array(0);
		}
		const req = await fetch_range({ url: this.url, offset, size });
		if (!req.ok) {
			throw new Error(
				`failed http request ${this.url}, status: ${req.status} offset: ${offset} size: ${size}: ${req.statusText}`,
			);
		}
		return new Uint8Array(await req.arrayBuffer());
	}
}

/** @experimental */
class ZipFileStore<R extends Reader> implements Async<Readable> {
	private info: Promise<ZipInfo>;
	constructor(reader: R) {
		this.info = unzip(reader);
	}

	async get(key: AbsolutePath) {
		let entry = (await this.info).entries[strip_prefix(key)];
		if (!entry) return;
		return new Uint8Array(await entry.arrayBuffer());
	}

	async has(key: AbsolutePath) {
		return strip_prefix(key) in (await this.info).entries;
	}

	static fromUrl(href: string | URL) {
		return new ZipFileStore(new HTTPRangeReader(href));
	}

	static fromBlob(blob: Blob) {
		return new ZipFileStore(new BlobReader(blob));
	}
}

export default ZipFileStore;
