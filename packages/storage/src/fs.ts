import * as fs from "node:fs";
import * as path from "node:path";

import type { AbsolutePath, Async, Writeable } from "./types.js";
import { strip_prefix } from "./util.js";

class FileSystemStore implements Async<Writeable> {
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
}

export default FileSystemStore;
