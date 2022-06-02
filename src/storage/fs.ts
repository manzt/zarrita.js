import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as stream from "node:stream";
import { strip_prefix } from "./util";

import type {
	AbsolutePath,
	Async,
	ExtendedReadable,
	PrefixPath,
	RootPath,
	Writeable,
} from "../types";


class FileSystemStore implements Async<ExtendedReadable & Writeable> {
	constructor(public root: string) {}

	async get(key: AbsolutePath) {
		const fp = path.join(this.root, strip_prefix(key));
		try {
			let filehandle = await fsp.open(fp);
			// Could use `file.readableWebStream()` but this doesn't close the
			// underlying filehandle once the resource is read. The following
			// allows us to create a response that closes the filehandle once read.
			const readable = filehandle.createReadStream({ autoClose: true });
			// @ts-expect-error `Readable.toWeb` is avaiable in Node v17 but not in `@types/node`
			return new Response(stream.Readable.toWeb(readable));
		} catch (err: any) {
			if (err.code === "ENOENT") {
				return new Response(null, { status: 404 })
			}
			throw err;
		}
	}

	has(key: AbsolutePath) {
		const fp = path.join(this.root, strip_prefix(key));
		return fsp.access(fp).then(() => true).catch(() => false);
	}

	async set(key: AbsolutePath, value: Uint8Array): Promise<void> {
		const fp = path.join(this.root, strip_prefix(key));
		await fsp.mkdir(path.dirname(fp), { recursive: true });
		await fsp.writeFile(fp, value, null);
	}

	async delete(key: AbsolutePath): Promise<boolean> {
		const fp = path.join(this.root, strip_prefix(key));
		await fsp.unlink(fp);
		return true;
	}

	async list_prefix(prefix: RootPath | PrefixPath) {
		const fp = path.join(this.root, prefix.slice(1));
		try {
			const items = [];
			for await (const file of walk(fp)) {
				items.push(file.split(fp)[1]);
			}
			return items;
		} catch (err: any) {
			if (err.code === "ENOENT") return [];
			throw err;
		}
	}

	async list_dir(prefix: RootPath | PrefixPath = "/") {
		const contents: string[] = [];
		const prefixes: string[] = []; // could have redundant keys

		const fp = path.join(this.root, prefix.slice(1));
		try {
			const dir = await fsp.readdir(fp, { withFileTypes: true });
			dir.forEach((d) => {
				if (d.isFile()) contents.push(d.name);
				if (d.isDirectory()) prefixes.push(d.name); // directory
			});
		} catch (err: any) {
			if (err.code === "ENOENT") {
				return { contents: [], prefixes: [] };
			}
			throw err;
		}
		return { contents, prefixes };
	}
}

async function* walk(dir: string): AsyncGenerator<string> {
	const dirents = await fsp.readdir(dir, { withFileTypes: true });
	for (const dirent of dirents) {
		const res = path.join(dir, dirent.name);
		if (dirent.isDirectory()) {
			yield* walk(res);
		} else {
			yield res;
		}
	}
}

export default FileSystemStore;
