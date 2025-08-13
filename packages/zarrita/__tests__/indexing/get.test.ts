import * as path from "node:path";
import * as url from "node:url";
import FileSystemStore from "@zarrita/storage/fs";
import { describe, expect, it } from "vitest";

import * as zarr from "../../src/index.js";
import { get } from "../../src/indexing/ops.js";
import type { ChunkCache } from "../../src/indexing/types.js";
import { range } from "../../src/indexing/util.js";
import type { Chunk, DataType } from "../../src/metadata.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function get_v2(
	abs_path: string,
	...args: unknown[]
): Promise<zarr.Chunk<zarr.DataType>> {
	let root = path.resolve(__dirname, "../../../../fixtures/v2/data.zarr");
	let store = zarr.root(new FileSystemStore(root));
	let arr = await zarr.open.v2(store.resolve(abs_path), { kind: "array" });
	// @ts-expect-error - TS not happy about spreading these args and its fine for this func
	return get(arr, ...args);
}

describe("get v2", () => {
	it("1d.contiguous.zlib.i2", async () => {
		expect(await get_v2("/1d.contiguous.zlib.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.blosc.i2", async () => {
		expect(await get_v2("/1d.contiguous.blosc.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.lz4.i2", async () => {
		expect(await get_v2("/1d.contiguous.lz4.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.zstd.i2", async () => {
		expect(await get_v2("/1d.contiguous.zstd.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.raw.i2", async () => {
		expect(await get_v2("/1d.contiguous.raw.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.i4", async () => {
		expect(await get_v2("/1d.contiguous.i4")).toMatchInlineSnapshot(`
			{
			  "data": Int32Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.u1", async () => {
		expect(await get_v2("/1d.contiguous.u1")).toMatchInlineSnapshot(`
			{
			  "data": Uint8Array [
			    255,
			    0,
			    255,
			    0,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.f4.le", async () => {
		expect(await get_v2("/1d.contiguous.f4.le")).toMatchInlineSnapshot(`
			{
			  "data": Float32Array [
			    -1000.5,
			    0,
			    1000.5,
			    0,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.f4.be", async () => {
		expect(await get_v2("/1d.contiguous.f4.be")).toMatchInlineSnapshot(`
			{
			  "data": Float32Array [
			    -1000.5,
			    0,
			    1000.5,
			    0,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.f8", async () => {
		expect(await get_v2("/1d.contiguous.f8")).toMatchInlineSnapshot(`
			{
			  "data": Float64Array [
			    1.5,
			    2.5,
			    3.5,
			    4.5,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.U13.le", async () => {
		let res = await get_v2("/1d.contiguous.U13.le");
		expect(res.data).toBeInstanceOf(zarr.UnicodeStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.U13.be", async () => {
		let res = await get_v2("/1d.contiguous.U13.be");
		expect(res.data).toBeInstanceOf(zarr.UnicodeStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.U7", async () => {
		let res = await get_v2("/1d.contiguous.U7");
		expect(res.data).toBeInstanceOf(zarr.UnicodeStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.S7", async () => {
		let res = await get_v2("/1d.contiguous.S7");
		expect(res.data).toBeInstanceOf(zarr.ByteStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.b1", async () => {
		let res = await get_v2("/1d.contiguous.b1");
		expect(res).toMatchInlineSnapshot(`
			{
			  "data": BoolArray {},
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
		expect(Array.from(res.data)).toStrictEqual([true, false, true, false]);
	});

	it("2d.contiguous.i2", async () => {
		expect(await get_v2("/2d.contiguous.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    2,
			    2,
			  ],
			  "stride": [
			    2,
			    1,
			  ],
			}
		`);
	});

	it("3d.contiguous.i2", async () => {
		expect(await get_v2("/3d.contiguous.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    0,
			    1,
			    2,
			    3,
			    4,
			    5,
			    6,
			    7,
			    8,
			    9,
			    10,
			    11,
			    12,
			    13,
			    14,
			    15,
			    16,
			    17,
			    18,
			    19,
			    20,
			    21,
			    22,
			    23,
			    24,
			    25,
			    26,
			  ],
			  "shape": [
			    3,
			    3,
			    3,
			  ],
			  "stride": [
			    9,
			    3,
			    1,
			  ],
			}
		`);
	});

	it("1d.chunked.i2", async () => {
		expect(await get_v2("/1d.chunked.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.chunked.ragged.i2", async () => {
		expect(await get_v2("/1d.chunked.ragged.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			    5,
			  ],
			  "shape": [
			    5,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("2d.chunked.i2", async () => {
		expect(await get_v2("/2d.chunked.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    2,
			    2,
			  ],
			  "stride": [
			    2,
			    1,
			  ],
			}
		`);
	});

	it("2d.chunked.U7", async () => {
		let res = await get_v2("/2d.chunked.U7");
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([2, 2]);
	});

	it("2d.chunked.ragged.i2", async () => {
		expect(await get_v2("/2d.chunked.ragged.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			    5,
			    6,
			    7,
			    8,
			    9,
			  ],
			  "shape": [
			    3,
			    3,
			  ],
			  "stride": [
			    3,
			    1,
			  ],
			}
		`);
	});

	it("3d.chunked.i2", async () => {
		expect(await get_v2("/3d.chunked.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    0,
			    1,
			    2,
			    3,
			    4,
			    5,
			    6,
			    7,
			    8,
			    9,
			    10,
			    11,
			    12,
			    13,
			    14,
			    15,
			    16,
			    17,
			    18,
			    19,
			    20,
			    21,
			    22,
			    23,
			    24,
			    25,
			    26,
			  ],
			  "shape": [
			    3,
			    3,
			    3,
			  ],
			  "stride": [
			    9,
			    3,
			    1,
			  ],
			}
		`);
	});

	it("3d.chunked.mixed.i2.C", async () => {
		expect(await get_v2("/3d.chunked.mixed.i2.C")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    0,
			    1,
			    2,
			    3,
			    4,
			    5,
			    6,
			    7,
			    8,
			    9,
			    10,
			    11,
			    12,
			    13,
			    14,
			    15,
			    16,
			    17,
			    18,
			    19,
			    20,
			    21,
			    22,
			    23,
			    24,
			    25,
			    26,
			  ],
			  "shape": [
			    3,
			    3,
			    3,
			  ],
			  "stride": [
			    9,
			    3,
			    1,
			  ],
			}
		`);
	});

	it("3d.chunked.mixed.i2.F", async () => {
		let res = await get_v2("/3d.chunked.mixed.i2.F");
		// biome-ignore format: the array should not be formatted
		expect(res.data).toStrictEqual(new Int16Array([
			0, 9, 18, 3, 12, 21, 6, 15, 24,
			1, 10, 19, 4, 13, 22, 7, 16, 25,
			2, 11, 20, 5, 14, 23, 8, 17, 26,
		]));
		expect(res.shape).toStrictEqual([3, 3, 3]);
		expect(res.stride).toStrictEqual([1, 3, 9]);
	});

	it("3d.chunked.O", async () => {
		let arr = await get_v2("/3d.chunked.O");
		expect(arr).toStrictEqual({
			data: ["a", "aa", "aaa", "aaaa", "b", "bb", "bbb", "bbbb"],
			shape: [2, 2, 2],
			stride: [4, 2, 1],
		});
	});
});

async function get_v3(
	abs_path: string,
	...args: unknown[]
): Promise<zarr.Chunk<zarr.DataType>> {
	let root = path.resolve(__dirname, "../../../../fixtures/v3/data.zarr");
	let store = zarr.root(new FileSystemStore(root));
	let arr = await zarr.open.v3(store.resolve(abs_path), { kind: "array" });
	// @ts-expect-error - TS not happy about spreading these args
	return get(arr, ...args);
}

describe("get v3", () => {
	it("1d.contiguous.gzip.i2", async () => {
		let res = await get_v3("/1d.contiguous.gzip.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.blosc.i2", async () => {
		let res = await get_v3("/1d.contiguous.blosc.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.raw.i2", async () => {
		let res = await get_v3("/1d.contiguous.raw.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.i4", async () => {
		let res = await get_v3("/1d.contiguous.i4");
		expect(res.data).toStrictEqual(new Int32Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.u1", async () => {
		let res = await get_v3("/1d.contiguous.u1");
		expect(res.data).toStrictEqual(new Uint8Array([255, 0, 255, 0]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.f4.le", async () => {
		let res = await get_v3("/1d.contiguous.f4.le");
		expect(res.data).toStrictEqual(new Float32Array([-1000.5, 0, 1000.5, 0]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.f4.be", async () => {
		let res = await get_v3("/1d.contiguous.f4.be");
		expect(res.data).toStrictEqual(new Float32Array([-1000.5, 0, 1000.5, 0]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.f8", async () => {
		let res = await get_v3("/1d.contiguous.f8");
		expect(res.data).toStrictEqual(new Float64Array([1.5, 2.5, 3.5, 4.5]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.b1", async () => {
		let res = await get_v3("/1d.contiguous.b1");
		expect(res.data).toBeInstanceOf(zarr.BoolArray);
		expect(Array.from(res.data as zarr.BoolArray)).toStrictEqual([
			true,
			false,
			true,
			false,
		]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("2d.contiguous.i2", async () => {
		let res = await get_v3("/2d.contiguous.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([2, 2]);
	});

	it("3d.contiguous.i2", async () => {
		let res = await get_v3("/3d.contiguous.i2");
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
	});

	it("1d.chunked.i2", async () => {
		let res = await get_v3("/1d.chunked.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.chunked.ragged.i2", async () => {
		let res = await get_v3("/1d.chunked.ragged.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4, 5]));
		expect(res.shape).toStrictEqual([5]);
	});

	it("2d.chunked.i2", async () => {
		let res = await get_v3("/2d.chunked.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([2, 2]);
	});

	it("2d.chunked.ragged.i2", async () => {
		let res = await get_v3("/2d.chunked.ragged.i2");
		expect(res.data).toStrictEqual(new Int16Array(range(1, 10)));
		expect(res.shape).toStrictEqual([3, 3]);
	});

	it("3d.chunked.i2", async () => {
		let res = await get_v3("/3d.chunked.i2");
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
	});

	it("3d.chunked.mixed.i2.C", async () => {
		let res = await get_v3("/3d.chunked.mixed.i2.C");
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
		expect(res.stride).toStrictEqual([9, 3, 1]);
	});

	it("3d.chunked.mixed.i2.F", async () => {
		let res = await get_v3("/3d.chunked.mixed.i2.F");
		// biome-ignore format: the array should not be formatted
		expect(res.data).toStrictEqual(new Int16Array([
			0, 9, 18, 3, 12, 21, 6, 15, 24,
			1, 10, 19, 4, 13, 22, 7, 16, 25,
			2, 11, 20, 5, 14, 23, 8, 17, 26,
		]));
		expect(res.shape).toStrictEqual([3, 3, 3]);
		expect(res.stride).toStrictEqual([1, 3, 9]);
	});
});

describe("chunk caching", () => {
	async function get_array_with_cache(): Promise<zarr.Array<"int16">> {
		let root = path.resolve(__dirname, "../../../../fixtures/v3/data.zarr");
		let store = zarr.root(new FileSystemStore(root));
		return zarr.open.v3(store.resolve("/2d.chunked.i2"), {
			kind: "array",
		}) as Promise<zarr.Array<"int16">>;
	}

	it("should work without cache (default behavior)", async () => {
		let arr = await get_array_with_cache();
		let result = await get(arr, null);

		expect(result.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(result.shape).toStrictEqual([2, 2]);
	});

	it("should work with Map as cache", async () => {
		let arr = await get_array_with_cache();
		let cache = new Map();

		// First call should populate cache
		let result1 = await get(arr, null, { cache });
		expect(result1.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		const cacheSize = cache.size;
		expect(cacheSize).toBeGreaterThan(0);

		// Second call should use cache
		let result2 = await get(arr, null, { cache });
		expect(result2.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(result2.shape).toStrictEqual([2, 2]);
		expect(cache.size).toBe(cacheSize);
	});

	it("should cache chunks with proper keys", async () => {
		let arr = await get_array_with_cache();
		let cache = new Map();

		await get(arr, null, { cache });

		let keys = Array.from(cache.keys());
		expect(keys.length).toBeGreaterThan(0);

		// Keys should contain store ID, array path and chunk coordinates
		for (let key of keys) {
			expect(key).toMatch(
				/^store_\d+:\/2d\.chunked\.i2:c[.\\/]\d+([.\\/]\d+)*$/,
			);
		}
	});

	it("should reuse cached chunks across multiple calls", async () => {
		let arr = await get_array_with_cache();
		let cache = new Map();

		let originalGetChunk = arr.getChunk;
		let getChunkCallCount = 0;
		arr.getChunk = async (...args) => {
			getChunkCallCount++;
			return originalGetChunk.call(arr, ...args);
		};

		// First call
		await get(arr, null, { cache });
		let firstCallCount = getChunkCallCount;
		expect(firstCallCount).toBeGreaterThan(0);

		// Second call should not fetch chunks again
		await get(arr, null, { cache });
		expect(getChunkCallCount).toBe(firstCallCount);

		// Restore original method
		arr.getChunk = originalGetChunk;
	});

	it("should work with custom cache implementation", async () => {
		let arr = await get_array_with_cache();

		// Custom cache that tracks operations
		let operations: string[] = [];
		let cache: ChunkCache = {
			get(key: string) {
				operations.push(`get:${key}`);
				return undefined; // Always miss for this test
			},
			set(key: string, _value: Chunk<DataType>) {
				operations.push(`set:${key}`);
			},
		};

		let result = await get(arr, null, { cache });

		expect(result.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(operations.length).toBeGreaterThan(0);
		expect(operations.some((op) => op.startsWith("get:"))).toBe(true);
		expect(operations.some((op) => op.startsWith("set:"))).toBe(true);
	});

	it("should handle cache hits correctly", async () => {
		let arr = await get_array_with_cache();

		// First, find out what cache keys are needed by doing a real call
		let cache = new Map();
		await get(arr, null, { cache });
		let realKeys = Array.from(cache.keys());
		let realValues = Array.from(cache.values());

		// Clear cache and pre-populate ALL chunks with fake data using the correct keys
		cache.clear();
		for (let i = 0; i < realKeys.length; i++) {
			let fakeChunkData = {
				data: new Int16Array([99, 98, 97, 96]), // Use same fake data for all chunks
				shape: realValues[i].shape, // Use original shape
				stride: realValues[i].stride, // Use original stride
			};
			cache.set(realKeys[i], fakeChunkData);
		}

		// Mock getChunk to ensure it's not called
		let originalGetChunk = arr.getChunk;
		arr.getChunk = async () => {
			throw new Error("getChunk should not be called when cache hits");
		};

		try {
			let result = await get(arr, null, { cache });
			// Should get some fake data (exact result depends on how chunks are assembled)
			expect(result.data).toBeInstanceOf(Int16Array);
			expect(result.shape).toStrictEqual([2, 2]);
		} finally {
			// Restore original method
			arr.getChunk = originalGetChunk;
		}
	});

	it("should handle different arrays with separate cache entries", async () => {
		let root = path.resolve(__dirname, "../../../../fixtures/v3/data.zarr");
		let store = zarr.root(new FileSystemStore(root));

		let arr1 = await zarr.open.v3(store.resolve("/1d.contiguous.raw.i2"), {
			kind: "array",
		});
		let arr2 = await zarr.open.v3(store.resolve("/2d.contiguous.i2"), {
			kind: "array",
		});

		let cache = new Map();

		await get(arr1, null, { cache });
		await get(arr2, null, { cache });

		// Should have separate cache entries for different arrays
		let keys = Array.from(cache.keys());
		expect(keys.some((k) => k.includes("/1d.contiguous.raw.i2:"))).toBe(true);
		expect(keys.some((k) => k.includes("/2d.contiguous.i2:"))).toBe(true);
	});

	it("should handle multiple stores", async () => {
		let root1 = path.resolve(__dirname, "../../../../fixtures/v3/data.zarr");
		let store1 = zarr.root(new FileSystemStore(root1));
		let arr1 = await zarr.open.v3(store1.resolve("/2d.chunked.i2"), {
			kind: "array",
		});

		let root2 = path.resolve(__dirname, "../../../../fixtures/v2/data.zarr");
		let store2 = zarr.root(new FileSystemStore(root2));
		let arr2 = await zarr.open.v2(store2.resolve("/1d.contiguous.i4"), {
			kind: "array",
		});

		let cache = new Map();

		await get(arr1, null, { cache });
		await get(arr2, null, { cache });

		expect(cache.size).toBeGreaterThan(0);
		const storePrefixes = new Set(Array.from(cache.keys()).map((key) => {
			return key.split(":")[0]; // Extract store ID from cache key
		}));
		expect(storePrefixes.size).toBe(2); // Should have entries for both stores
	});

	it("should work with sliced access using cache", async () => {
		let arr = await get_array_with_cache();
		let cache = new Map();

		// Access a slice
		let result = await get(arr, [zarr.slice(0, 1), null], { cache });

		expect(result.shape).toStrictEqual([1, 2]);
		expect(cache.size).toBeGreaterThan(0);

		// Access another slice that might reuse same chunks
		let result2 = await get(arr, [zarr.slice(1, 2), null], { cache });
		expect(result2.shape).toStrictEqual([1, 2]);
	});
});
