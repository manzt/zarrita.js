import { describe, expect, it } from "vitest";

import FileSystemHandleStore from "../src/fs-handle.js";

type Tree = { [name: string]: Tree | string | Uint8Array };

interface Spy {
	/** Names passed to `getDirectoryHandle`, in call order. */
	calls: string[];
	/** Called after each chunk written to a writable stream; may throw. */
	onWrite?: () => void;
	/** Called before a writable stream commits on close; may throw. */
	onClose?: () => void;
}

/**
 * Minimal in-memory stand-in for a `FileSystemDirectoryHandle`.
 *
 * Errors are plain `Error`s with a `name` (not `DOMException`s), like those
 * from another realm, to check that the store matches errors by name.
 */
function createDirectoryHandle(
	tree: Tree,
	spy: Spy = { calls: [] },
): FileSystemDirectoryHandle {
	const error = (name: string, message: string) =>
		Object.assign(new Error(message), { name });
	const isFile = (entry: Tree[string]) =>
		typeof entry === "string" || entry instanceof Uint8Array;
	const handle = {
		async getDirectoryHandle(name: string, options?: { create?: boolean }) {
			spy.calls.push(name);
			if (tree[name] === undefined && options?.create) {
				tree[name] = {};
			}
			const entry = tree[name];
			if (entry === undefined) {
				throw error("NotFoundError", `${name} not found`);
			}
			if (isFile(entry)) {
				throw error("TypeMismatchError", `${name} is not a directory`);
			}
			return createDirectoryHandle(entry as Tree, spy);
		},
		async getFileHandle(name: string, options?: { create?: boolean }) {
			if (tree[name] === undefined && options?.create) {
				tree[name] = "";
			}
			const entry = tree[name];
			if (entry === undefined) {
				throw error("NotFoundError", `${name} not found`);
			}
			if (!isFile(entry)) {
				throw error("TypeMismatchError", `${name} is not a file`);
			}
			return {
				getFile: async () => new File([tree[name] as string], name),
				async createWritable() {
					const chunks: Uint8Array<ArrayBuffer>[] = [];
					return {
						async write(data: Uint8Array) {
							// like the File System API, reject views on a SharedArrayBuffer
							// or a resizable ArrayBuffer
							if (
								!(data.buffer instanceof ArrayBuffer) ||
								data.buffer.resizable
							) {
								throw new TypeError(
									"shared or resizable buffers are not allowed",
								);
							}
							chunks.push(data as Uint8Array<ArrayBuffer>);
							spy.onWrite?.();
						},
						async close() {
							spy.onClose?.();
							tree[name] = new Uint8Array(await new Blob(chunks).arrayBuffer());
						},
						async abort() {
							chunks.length = 0;
						},
					};
				},
			};
		},
		async removeEntry(name: string) {
			if (tree[name] === undefined) {
				throw error("NotFoundError", `${name} not found`);
			}
			delete tree[name];
		},
	};
	return handle as unknown as FileSystemDirectoryHandle;
}

const encode = (text: string) => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array | undefined) =>
	bytes && new TextDecoder().decode(bytes);

describe("FileSystemHandleStore", () => {
	const tree: Tree = {
		"zarr.json": "root",
		a: { b: { "zarr.json": "nested", c: "Hello, World!" } },
	};

	it("reads a file", async () => {
		const store = new FileSystemHandleStore(createDirectoryHandle(tree));
		expect(decode(await store.get("/zarr.json"))).toBe("root");
		expect(decode(await store.get("/a/b/zarr.json"))).toBe("nested");
	});

	it("returns undefined for a non-existent file", async () => {
		const store = new FileSystemHandleStore(createDirectoryHandle(tree));
		expect(await store.get("/missing")).toBe(undefined);
		expect(await store.get("/a/missing/zarr.json")).toBe(undefined);
	});

	it("returns undefined for a directory or a file used as a directory", async () => {
		const store = new FileSystemHandleStore(createDirectoryHandle(tree));
		expect(await store.get("/a")).toBe(undefined);
		expect(await store.get("/zarr.json/foo")).toBe(undefined);
	});

	it("rethrows errors other than missing entries", async () => {
		const root = {
			async getFileHandle() {
				throw new DOMException("permission revoked", "NotAllowedError");
			},
		} as unknown as FileSystemDirectoryHandle;
		const store = new FileSystemHandleStore(root);
		await expect(store.get("/zarr.json")).rejects.toThrow("permission revoked");
	});

	it("reads partial", async () => {
		const store = new FileSystemHandleStore(createDirectoryHandle(tree));
		const bytes = await store.getRange("/a/b/c", { offset: 7, length: 5 });
		expect(decode(bytes)).toBe("World");
		const bytes2 = await store.getRange("/a/b/c", { suffixLength: 6 });
		expect(decode(bytes2)).toBe("World!");
		const bytes3 = await store.getRange("/a/b/c", { suffixLength: 100 });
		expect(decode(bytes3)).toBe("Hello, World!");
		const bytes4 = await store.getRange("/a/b/c", { suffixLength: 0 });
		expect(decode(bytes4)).toBe("");
		expect(await store.getRange("/missing", { offset: 0, length: 1 })).toBe(
			undefined,
		);
	});

	it("caches directory handles", async () => {
		const spy: Spy = { calls: [] };
		const store = new FileSystemHandleStore(createDirectoryHandle(tree, spy));
		await Promise.all([store.get("/a/b/zarr.json"), store.get("/a/b/c")]);
		await store.get("/a/b/zarr.json");
		expect(spy.calls).toEqual(["a", "b"]);
	});

	it("does not cache failed directory lookups", async () => {
		const spy: Spy = { calls: [] };
		const tree: Tree = {};
		const store = new FileSystemHandleStore(createDirectoryHandle(tree, spy));
		expect(await store.get("/a/zarr.json")).toBe(undefined);
		tree.a = { "zarr.json": "created" };
		expect(decode(await store.get("/a/zarr.json"))).toBe("created");
		expect(spy.calls).toEqual(["a", "a"]);
	});

	it("writes a file, creating directories", async () => {
		const tree: Tree = {};
		const store = new FileSystemHandleStore(createDirectoryHandle(tree));
		await store.set("/a/b/zarr.json", encode("written"));
		expect(tree).toEqual({ a: { b: { "zarr.json": encode("written") } } });
		expect(decode(await store.get("/a/b/zarr.json"))).toBe("written");
		await store.set("/a/b/zarr.json", encode("overwritten"));
		expect(decode(await store.get("/a/b/zarr.json"))).toBe("overwritten");
	});

	it("writes views on shared or resizable buffers", async () => {
		const store = new FileSystemHandleStore(createDirectoryHandle({}));
		for (const buffer of [
			new SharedArrayBuffer(3),
			new ArrayBuffer(3, { maxByteLength: 6 }),
		]) {
			const value = new Uint8Array(buffer);
			value.set(encode("abc"));
			await store.set("/buffer", value);
			expect(decode(await store.get("/buffer"))).toBe("abc");
		}
	});

	it("rethrows when writing to a directory, keeping it", async () => {
		const tree: Tree = { a: {} };
		const store = new FileSystemHandleStore(createDirectoryHandle(tree));
		await expect(store.set("/a", encode("written"))).rejects.toMatchObject({
			name: "TypeMismatchError",
		});
		expect(tree).toEqual({ a: {} });
	});

	it("writes to a directory whose lookup failed concurrently", async () => {
		const store = new FileSystemHandleStore(createDirectoryHandle({}));
		const [missing] = await Promise.all([
			store.get("/a/zarr.json"),
			store.set("/a/zarr.json", encode("written")),
		]);
		expect(missing).toBe(undefined);
		expect(decode(await store.get("/a/zarr.json"))).toBe("written");
	});

	it("recreates a directory that was removed after being cached", async () => {
		const tree: Tree = { a: { "zarr.json": "old" } };
		const store = new FileSystemHandleStore(createDirectoryHandle(tree));
		expect(decode(await store.get("/a/zarr.json"))).toBe("old");
		delete tree.a;
		await store.set("/a/zarr.json", encode("new"));
		expect(tree).toEqual({ a: { "zarr.json": encode("new") } });
		expect(decode(await store.get("/a/zarr.json"))).toBe("new");
	});

	it("throws if the signal is already aborted", async () => {
		const tree: Tree = { "zarr.json": "root" };
		const store = new FileSystemHandleStore(createDirectoryHandle(tree));
		const signal = AbortSignal.abort(new Error("aborted"));
		await expect(store.get("/zarr.json", { signal })).rejects.toThrow(
			"aborted",
		);
		await expect(
			store.getRange("/zarr.json", { suffixLength: 1 }, { signal }),
		).rejects.toThrow("aborted");
		await expect(
			store.set("/zarr.json", encode("written"), { signal }),
		).rejects.toThrow("aborted");
		expect(tree["zarr.json"]).toBe("root");
	});

	it("aborts a single caller without affecting others", async () => {
		const store = new FileSystemHandleStore(createDirectoryHandle(tree));
		const controller = new AbortController();
		const aborted = store.get("/a/b/zarr.json", { signal: controller.signal });
		const other = store.get("/a/b/c");
		controller.abort(new Error("aborted"));
		await expect(aborted).rejects.toThrow("aborted");
		expect(decode(await other)).toBe("Hello, World!");
	});

	it("discards a write aborted after the stream was opened", async () => {
		const controller = new AbortController();
		const spy: Spy = {
			calls: [],
			onWrite: () => controller.abort(new Error("aborted")),
		};
		const tree: Tree = { "zarr.json": "root" };
		const store = new FileSystemHandleStore(createDirectoryHandle(tree, spy));
		await expect(
			store.set("/zarr.json", encode("written"), {
				signal: controller.signal,
			}),
		).rejects.toThrow("aborted");
		expect(tree["zarr.json"]).toBe("root");
	});

	it("removes a new file when a write is aborted", async () => {
		const controller = new AbortController();
		const spy: Spy = {
			calls: [],
			onWrite: () => controller.abort(new Error("aborted")),
		};
		const tree: Tree = {};
		const store = new FileSystemHandleStore(createDirectoryHandle(tree, spy));
		await expect(
			store.set("/zarr.json", encode("written"), {
				signal: controller.signal,
			}),
		).rejects.toThrow("aborted");
		expect(tree).toEqual({});
	});

	it("removes a new file and rethrows when a write fails", async () => {
		const spy: Spy = {
			calls: [],
			onWrite: () => {
				throw new DOMException("quota exceeded", "QuotaExceededError");
			},
		};
		const tree: Tree = {};
		const store = new FileSystemHandleStore(createDirectoryHandle(tree, spy));
		await expect(store.set("/zarr.json", encode("written"))).rejects.toThrow(
			"quota exceeded",
		);
		expect(tree).toEqual({});
	});

	it("removes a new file and rethrows when committing a write fails", async () => {
		const spy: Spy = {
			calls: [],
			onClose: () => {
				throw new DOMException("quota exceeded", "QuotaExceededError");
			},
		};
		const tree: Tree = {};
		const store = new FileSystemHandleStore(createDirectoryHandle(tree, spy));
		await expect(store.set("/zarr.json", encode("written"))).rejects.toThrow(
			"quota exceeded",
		);
		expect(tree).toEqual({});
	});
});
