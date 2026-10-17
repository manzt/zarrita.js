import type { AbsolutePath, AsyncMutable, RangeQuery } from "./types.js";
import { stripPrefix } from "./util.js";

/**
 * Split a relative path into its parent path (`""` for the root) and its last
 * segment.
 */
function splitPath(path: string): [parentPath: string, name: string] {
	const lastPathSepIndex = path.lastIndexOf("/");
	return [
		path.slice(0, Math.max(lastPathSepIndex, 0)),
		path.slice(lastPathSepIndex + 1),
	];
}

/**
 * Get the `name` of an error (e.g., `"NotFoundError"`). Errors are matched by
 * name rather than by `instanceof DOMException`, to also match exceptions from
 * other realms (e.g., handles from an iframe).
 */
function getErrorName(err: unknown): unknown {
	return typeof err === "object" && err !== null && "name" in err
		? err.name
		: undefined;
}

/**
 * Store backed by a
 * [`FileSystemDirectoryHandle`](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle),
 * e.g., from the Origin Private File System (OPFS, all major browsers) or the
 * File System Access API (`showDirectoryPicker()`, Chromium only).
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/File_System_API}
 *
 * @example
 * ```ts
 * import * as zarr from "zarrita";
 * import { FileSystemHandleStore } from "@zarrita/storage";
 *
 * // File System Access API (Chromium-only, requires a user gesture)
 * let root = await showDirectoryPicker();
 * // or, Origin Private File System
 * // let root = await navigator.storage.getDirectory();
 *
 * let store = new FileSystemHandleStore(root);
 * let arr = await zarr.open(store, { kind: "array" });
 * ```
 */
class FileSystemHandleStore implements AsyncMutable {
	#root: FileSystemDirectoryHandle;
	#cache = new Map<string, Promise<FileSystemDirectoryHandle>>();

	/** @param root - The directory that store keys are resolved against. */
	constructor(root: FileSystemDirectoryHandle) {
		this.#root = root;
	}

	/**
	 * Read the file at `key`.
	 *
	 * @returns The file's bytes, or `undefined` if the key is absent.
	 */
	async get(
		key: AbsolutePath,
		options?: { signal?: AbortSignal },
	): Promise<Uint8Array | undefined> {
		const { signal } = options ?? {};
		signal?.throwIfAborted();
		const file = await this.#getFile(key, { signal });
		if (file === undefined) {
			return undefined;
		}
		const buffer = await file.arrayBuffer();
		signal?.throwIfAborted();
		return new Uint8Array(buffer);
	}

	/**
	 * Read part of the file at `key`, without reading the whole file.
	 *
	 * @param range - `{ offset, length }`, or `{ suffixLength }` for the last
	 * `suffixLength` bytes. Ranges past the end of the file are clamped.
	 * @returns The requested bytes, or `undefined` if the key is absent.
	 */
	async getRange(
		key: AbsolutePath,
		range: RangeQuery,
		options?: { signal?: AbortSignal },
	): Promise<Uint8Array | undefined> {
		const { signal } = options ?? {};
		signal?.throwIfAborted();
		const file = await this.#getFile(key, { signal });
		if (file === undefined) {
			return undefined;
		}
		const blob =
			"suffixLength" in range
				? file.slice(Math.max(file.size - range.suffixLength, 0))
				: file.slice(range.offset, range.offset + range.length);
		const buffer = await blob.arrayBuffer();
		signal?.throwIfAborted();
		return new Uint8Array(buffer);
	}

	/**
	 * Write `value` to the file at `key`, creating missing directories. If the
	 * write fails or is aborted, previous contents are kept (a new file is
	 * removed).
	 */
	async set(
		key: AbsolutePath,
		value: Uint8Array,
		options?: { signal?: AbortSignal },
	): Promise<void> {
		const { signal } = options ?? {};
		signal?.throwIfAborted();
		const [dirPath, fileName] = splitPath(stripPrefix(key));
		const dir = await this.#getDirectory(dirPath, true);
		signal?.throwIfAborted();
		const existed = await dir.getFileHandle(fileName).then(
			() => true,
			(error) => {
				if (getErrorName(error) === "NotFoundError") {
					return false;
				}
				throw error;
			},
		);
		signal?.throwIfAborted();
		let writable: FileSystemWritableFileStream | undefined;
		const fileHandle = await dir.getFileHandle(fileName, { create: true });
		try {
			signal?.throwIfAborted();
			writable = await fileHandle.createWritable();
			signal?.throwIfAborted();
			// `write` rejects views on a SharedArrayBuffer or a resizable
			// ArrayBuffer, so these are copied (into a plain ArrayBuffer)
			await writable.write(
				value.buffer instanceof ArrayBuffer && !value.buffer.resizable
					? (value as Uint8Array<ArrayBuffer>)
					: value.slice(),
			);
			signal?.throwIfAborted();
			await writable.close();
		} catch (error) {
			// Best-effort cleanup, rethrowing the original error: discard the
			// pending write (keeping any previous contents) and remove the file if
			// it is new, as an empty file would read as a present key. Caveat: a
			// file just created by a concurrent `set` of the same key is removed
			// too. New directories are kept, as they are not keys and removing
			// them could fail concurrent writes into them.
			await writable?.abort(error).catch(() => {});
			if (!existed) {
				await dir.removeEntry(fileName).catch(() => {});
			}
			throw error;
		}
	}

	/**
	 * Resolve the file at `key`.
	 *
	 * @returns A snapshot of the file, or `undefined` if the key is absent.
	 */
	async #getFile(
		key: AbsolutePath,
		options?: { signal?: AbortSignal },
	): Promise<File | undefined> {
		const { signal } = options ?? {};
		signal?.throwIfAborted();
		const [dirPath, fileName] = splitPath(stripPrefix(key));
		try {
			const dir = await this.#getDirectory(dirPath);
			signal?.throwIfAborted();
			const fileHandle = await dir.getFileHandle(fileName);
			signal?.throwIfAborted();
			const file = await fileHandle.getFile();
			signal?.throwIfAborted();
			return file;
		} catch (error) {
			const errorName = getErrorName(error);
			// a missing entry, or a file/directory where the other was expected
			if (errorName === "NotFoundError" || errorName === "TypeMismatchError") {
				return undefined;
			}
			throw error;
		}
	}

	/**
	 * Resolve (and cache) the handle of the directory at `path`, relative to the
	 * root. With `create`, cached lookups are skipped (and replaced) and missing
	 * directories are created, so writes never fail on a pending, failed, or
	 * stale cached lookup.
	 *
	 * Takes no signal, as the returned promise is shared between callers; callers
	 * must check their own signal after awaiting it.
	 */
	#getDirectory(
		path: string,
		create = false,
	): Promise<FileSystemDirectoryHandle> {
		if (path === "") {
			return Promise.resolve(this.#root);
		}
		if (!create) {
			const cachedDir = this.#cache.get(path);
			if (cachedDir !== undefined) {
				return cachedDir;
			}
		}
		const [parentDirPath, dirName] = splitPath(path);
		const dirPromise = this.#getDirectory(parentDirPath, create).then(
			(parentDir) => parentDir.getDirectoryHandle(dirName, { create }),
		);
		// evict failed lookups (e.g., missing directories) from the cache,
		// unless they have already been superseded by a newer lookup
		dirPromise.catch(() => {
			if (this.#cache.get(path) === dirPromise) {
				this.#cache.delete(path);
			}
		});
		this.#cache.set(path, dirPromise);
		return dirPromise;
	}
}

export default FileSystemHandleStore;
