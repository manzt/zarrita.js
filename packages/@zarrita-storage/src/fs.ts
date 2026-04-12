import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import * as path from "node:path";

import type {
	AbsolutePath,
	AsyncMutable,
	GetOptions,
	RangeQuery,
} from "./types.js";
import { stripPrefix } from "./util.js";

function isErrorNoEntry(err: unknown): err is { code: "ENOENT" } {
	const isObject = typeof err === "object" && err !== null;
	return isObject && "code" in err && err.code === "ENOENT";
}

class FileSystemStore implements AsyncMutable {
	constructor(public root: string) {}

	async get(
		key: AbsolutePath,
		opts: GetOptions = {},
	): Promise<Uint8Array | undefined> {
		opts.signal?.throwIfAborted();
		let fp = path.join(this.root, stripPrefix(key));
		return fs.promises
			.readFile(fp, { signal: opts.signal })
			.catch((err: NodeJS.ErrnoException) => {
				if (err.code === "ENOENT") return undefined;
				throw err;
			});
	}

	async getRange(
		key: AbsolutePath,
		range: RangeQuery,
		opts: GetOptions = {},
	): Promise<Uint8Array | undefined> {
		opts.signal?.throwIfAborted();
		let fp = path.join(this.root, stripPrefix(key));
		let filehandle: fs.promises.FileHandle | undefined;
		try {
			filehandle = await fs.promises.open(fp, "r");
			if ("suffixLength" in range) {
				let stats = await filehandle.stat();
				let data = Buffer.alloc(range.suffixLength);
				await filehandle.read(
					data,
					0,
					range.suffixLength,
					stats.size - range.suffixLength,
				);
				opts.signal?.throwIfAborted();
				return data;
			}
			let data = Buffer.alloc(range.length);
			await filehandle.read(data, 0, range.length, range.offset);
			opts.signal?.throwIfAborted();
			return data;
		} catch (err: unknown) {
			// return undefined is no file or directory
			if (isErrorNoEntry(err)) {
				return undefined;
			}
			throw err;
		} finally {
			await filehandle?.close();
		}
	}

	async has(key: AbsolutePath): Promise<boolean> {
		const fp = path.join(this.root, stripPrefix(key));
		return fs.promises
			.access(fp)
			.then(() => true)
			.catch(() => false);
	}

	async set(key: AbsolutePath, value: Uint8Array): Promise<void> {
		const fp = path.join(this.root, stripPrefix(key));
		await fs.promises.mkdir(path.dirname(fp), { recursive: true });
		await fs.promises.writeFile(fp, value, null);
	}

	async delete(key: AbsolutePath): Promise<boolean> {
		const fp = path.join(this.root, stripPrefix(key));
		await fs.promises.unlink(fp);
		return true;
	}
}

export default FileSystemStore;
