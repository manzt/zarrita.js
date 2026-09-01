import type { AbsolutePath, AsyncReadable } from "./types.js";

/**
 * Get a file handle to a file in a directory.
 *
 * @param root - A root directory from the Web File System API.
 * @param path - A key to a file in the root directory.
 * @returns A file handle to the file.
 */
async function resolveFileHandleForPath(
	root: FileSystemDirectoryHandle,
	path: string,
): Promise<FileSystemFileHandle> {
	const dirs = path.split("/");
	const fname = dirs.pop();
	if (!fname) {
		throw new Error("Invalid path");
	}
	for (const dir of dirs) {
		root = await root.getDirectoryHandle(dir);
	}
	return root.getFileHandle(fname);
}

/**
 * A store for zarrita based on the Web File System API.
 *
 * Note: usage requires prompting the user to select a directory to grant
 * access to the Web File System API.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/File_System_API}
 *
 * @example
 * ```js
 * import * as zarr from "zarrita";
 * import WebFileSystemStore from "@zarrita/storage/web-fs";
 *
 * let directoryHandle = await globalThis.showDirectoryPicker();
 * let store = new WebFileSystemStore(directoryHandle);
 * let root = await zarr.root(store);
 * let arr = await zarr.open(root.resolve("/foo"), { kind: "array" });
 * ```
 */
class WebFileSystemStore implements AsyncReadable {
	#root: FileSystemDirectoryHandle;

	constructor(root: FileSystemDirectoryHandle) {
		this.#root = root;
	}

	async get(key: AbsolutePath): Promise<Uint8Array | undefined> {
		let fh = await resolveFileHandleForPath(this.#root, key.slice(1)).catch(
			() => {
				// TODO: better error handling
				// I believe a missing file will trigger an error here, which we should explicitly
				// catch and return `undefined`
				return undefined;
			},
		);
		if (!fh) {
			return undefined;
		}
		let file = await fh.getFile();
		let buffer = await file.arrayBuffer();
		return new Uint8Array(buffer);
	}
}

export default WebFileSystemStore;
