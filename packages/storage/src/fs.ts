import * as fs from "node:fs";
import * as path from "node:path";
import { strip_prefix } from "./util";

import type {
	AbsolutePath,
	Async,
	ExtendedReadable,
	PrefixPath,
	RootPath,
	Writeable,
} from "@zarrita/types";

class FileSystemStore implements Async<ExtendedReadable & Writeable> {
	constructor(public root: string) {}

	get(key: AbsolutePath): Promise<Uint8Array | undefined> {
		const fp = path.join(this.root, strip_prefix(key));
		return fs.promises.readFile(fp)
			.then((buf) => new Uint8Array(buf.buffer))
			.catch((err) => {
				// return undefined is no file or directory
				if (err.code === "ENOENT") return undefined;
				throw err;
			});
	}

	has(key: AbsolutePath): Promise<boolean> {
		const fp = path.join(this.root, strip_prefix(key));
		return fs.promises.access(fp).then(() => true).catch(() => false);
	}

	async set(key: AbsolutePath, value: Uint8Array): Promise<void> {
		const fp = path.join(this.root, strip_prefix(key));
		await fs.promises.mkdir(path.dirname(fp), { recursive: true });
		await fs.promises.writeFile(fp, value, null);
	}

	async delete(key: AbsolutePath): Promise<boolean> {
		const fp = path.join(this.root, strip_prefix(key));
		await fs.promises.unlink(fp);
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
			const dir = await fs.promises.readdir(fp, { withFileTypes: true });
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
	const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
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
