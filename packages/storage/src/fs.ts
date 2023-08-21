import * as fs from "node:fs";
import * as path from "node:path";

import type { AbsolutePath, AsyncMutable, GetOptions } from "./types.js";
import { strip_prefix } from "./util.js";

class FileSystemStore implements AsyncMutable {
	constructor(public root: string) {}

	async get(
		key: AbsolutePath,
		options?: GetOptions,
	): Promise<Uint8Array | undefined> {
		const fp = path.join(this.root, strip_prefix(key));
		let filehandle: fs.promises.FileHandle | undefined;
		try {
			filehandle = await fs.promises.open(fp, "r");
			if (options?.length !== undefined && options?.offset !== undefined) {
				let data = Buffer.alloc(options.length);
				await filehandle.read(data, 0, options.length, options.offset);
				return data;
			}
			return filehandle.readFile();
		} catch (err: any) {
			// return undefined is no file or directory
			if (err?.code === "ENOENT") return undefined;
			throw err;
		} finally {
			await filehandle?.close();
		}
	}

	async has(key: AbsolutePath): Promise<boolean> {
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
}

export default FileSystemStore;
