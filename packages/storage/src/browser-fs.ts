import { strip_prefix } from "./util";

import type { AbsolutePath, Async, Readable } from "@zarrita/types";

async function get_filehandle(root: FileSystemDirectoryHandle, path: AbsolutePath) {
	const dirs = strip_prefix(path).split("/");
	const fname = dirs.pop()!;
	for (const dir of dirs) {
		root = await root.getDirectoryHandle(dir);
	}
	return root.getFileHandle(fname);
}

class BrowserFileSystemStore implements Async<Readable> {
	constructor(public root: FileSystemDirectoryHandle) {}

	static async fromDirectoryPicker() {
		return new BrowserFileSystemStore(await window.showDirectoryPicker());
	}

	get(key: AbsolutePath): Promise<Uint8Array | undefined> {
		return get_filehandle(this.root, key)
			.then((fh) => fh.getFile())
			.then((file) => file.arrayBuffer())
			.then((buf) => new Uint8Array(buf))
			.catch(() => undefined);
	}

	has(key: AbsolutePath): Promise<boolean> {
		return get_filehandle(this.root, key)
			.then(() => true)
			.catch(() => false);
	}
}

export default BrowserFileSystemStore;
