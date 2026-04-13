import * as path from "node:path";
import * as url from "node:url";
import { describe, expect, it } from "vitest";
import { defineArrayExtension } from "../src/extension/define-array.js";
import * as zarr from "../src/index.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));
let fixturesRoot = path.resolve(__dirname, "../../../fixtures/v3/data.zarr");

async function openFixture(name: string) {
	let store = new zarr.FileSystemStore(fixturesRoot);
	return zarr.open.v3(zarr.root(store).resolve(name), { kind: "array" });
}

describe("defineArrayExtension", () => {
	it("intercepts getChunk", async () => {
		let calls: number[][] = [];
		let withTrace = defineArrayExtension((array) => ({
			async getChunk(coords, options) {
				calls.push(coords);
				return array.getChunk(coords, options);
			},
		}));
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = withTrace(arr);
		let chunk = await wrapped.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(Int16Array);
		expect(calls).toEqual([[0]]);
	});

	it("pass-through getters still work (private field access)", async () => {
		let withNoop = defineArrayExtension((_array) => ({}));
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = withNoop(arr);
		// These all read from `this.#metadata` via getters on Array.
		expect(wrapped.shape).toEqual(arr.shape);
		expect(wrapped.dtype).toBe(arr.dtype);
		expect(wrapped.chunks).toEqual(arr.chunks);
		expect(wrapped.attrs).toEqual(arr.attrs);
	});

	it("extensions appear on the wrapped array", async () => {
		let withCounter = defineArrayExtension((_array) => {
			let n = 0;
			return {
				bump() {
					n += 1;
				},
				get count(): number {
					return n;
				},
			};
		});
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = withCounter(arr);
		wrapped.bump();
		wrapped.bump();
		expect(wrapped.count).toBe(2);
	});

	it("works with zarr.get through the interception chain", async () => {
		let cache = new Map<string, zarr.Chunk<zarr.DataType>>();
		let withCache = defineArrayExtension((array) => ({
			async getChunk(coords, options) {
				let key = coords.join(",");
				let hit = cache.get(key);
				if (hit) return hit;
				let chunk = await array.getChunk(coords, options);
				cache.set(key, chunk);
				return chunk;
			},
		}));
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = withCache(arr);
		let a = await zarr.get(wrapped);
		let b = await zarr.get(wrapped);
		expect(a.data).toStrictEqual(b.data);
		// Second pass should hit the cache for each chunk.
		expect(cache.size).toBeGreaterThan(0);
	});
});

describe("extendArray", () => {
	it("no extension returns the array as-is", async () => {
		let arr = await openFixture("1d.chunked.i2");
		let result = await zarr.extendArray(arr);
		expect(result).toBe(arr);
	});

	it("composes multiple extensions in order", async () => {
		let order: string[] = [];
		let withA = defineArrayExtension((_array) => ({
			tagA: "a",
			async getChunk(coords, options) {
				order.push("a");
				return _array.getChunk(coords, options);
			},
		}));
		let withB = defineArrayExtension((_array) => ({
			tagB: "b",
			async getChunk(coords, options) {
				order.push("b");
				return _array.getChunk(coords, options);
			},
		}));
		let arr = await openFixture("1d.chunked.i2");
		let wrapped = await zarr.extendArray(
			arr,
			(a) => withA(a),
			(a) => withB(a),
		);
		expect(wrapped.tagA).toBe("a");
		expect(wrapped.tagB).toBe("b");
		await wrapped.getChunk([0]);
		// Outer wrapper runs first; it calls through to inner.
		expect(order).toEqual(["b", "a"]);
	});
});

describe("zarr.open auto-apply of store arrayExtensions", () => {
	it("applies a single array extension contributed by a store extension", async () => {
		let calls: number[][] = [];
		let withTrace = defineArrayExtension((array) => ({
			async getChunk(coords, options) {
				calls.push(coords);
				return array.getChunk(coords, options);
			},
		}));
		let withTracedArray = zarr.defineStoreExtension(() => ({
			arrayExtensions: [(a) => withTrace(a)],
		}));
		let store = withTracedArray(new zarr.FileSystemStore(fixturesRoot));
		let arr = await zarr.open.v3(zarr.root(store).resolve("1d.chunked.i2"), {
			kind: "array",
		});
		await arr.getChunk([0]);
		expect(calls).toEqual([[0]]);
	});

	it("merges inner-first, outer-last across stacked store extensions", async () => {
		let order: string[] = [];
		let withA = defineArrayExtension((array) => ({
			async getChunk(coords, options) {
				order.push("a");
				return array.getChunk(coords, options);
			},
		}));
		let withB = defineArrayExtension((array) => ({
			async getChunk(coords, options) {
				order.push("b");
				return array.getChunk(coords, options);
			},
		}));
		let storeExtA = zarr.defineStoreExtension(() => ({
			arrayExtensions: [(a) => withA(a)],
		}));
		let storeExtB = zarr.defineStoreExtension(() => ({
			arrayExtensions: [(a) => withB(a)],
		}));
		let store = await zarr.extendStore(
			new zarr.FileSystemStore(fixturesRoot),
			storeExtA,
			storeExtB,
		);
		// Merged list is visible as a plain field on the composed store.
		expect(
			(store as { arrayExtensions?: unknown[] }).arrayExtensions,
		).toHaveLength(2);
		let arr = await zarr.open.v3(zarr.root(store).resolve("1d.chunked.i2"), {
			kind: "array",
		});
		await arr.getChunk([0]);
		// Outer store extension (B) becomes the outermost array wrapper, so
		// its getChunk runs first and calls through to A.
		expect(order).toEqual(["b", "a"]);
	});

	it("auto-applies on arrays resolved via a group", async () => {
		let calls: number[][] = [];
		let withTrace = defineArrayExtension((array) => ({
			async getChunk(coords, options) {
				calls.push(coords);
				return array.getChunk(coords, options);
			},
		}));
		let withTracedArray = zarr.defineStoreExtension(() => ({
			arrayExtensions: [(a) => withTrace(a)],
		}));
		let store = withTracedArray(new zarr.FileSystemStore(fixturesRoot));
		let group = await zarr.open.v3(zarr.root(store), { kind: "group" });
		let arr = await zarr.open.v3(group.resolve("1d.chunked.i2"), {
			kind: "array",
		});
		await arr.getChunk([0]);
		expect(calls).toEqual([[0]]);
	});

	it("returns the array as-is when the store has no arrayExtensions", async () => {
		let store = new zarr.FileSystemStore(fixturesRoot);
		let arr = await zarr.open.v3(zarr.root(store).resolve("1d.chunked.i2"), {
			kind: "array",
		});
		// No Proxy wrapping — the returned Array is the concrete class instance.
		expect(arr).toBeInstanceOf(zarr.Array);
	});
});
