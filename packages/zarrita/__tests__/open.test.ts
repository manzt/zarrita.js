import * as path from "node:path";
import * as url from "node:url";
import { Float16Array } from "@petamoriken/float16";
import { type AbsolutePath, FileSystemStore } from "@zarrita/storage";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { NodeNotFoundError } from "../src/errors.js";
import { root } from "../src/hierarchy.js";
import type {
	ArrayMetadata,
	ArrayMetadataV2,
	GroupMetadata,
	GroupMetadataV2,
} from "../src/metadata.js";
import { open } from "../src/open.js";
import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "../src/typedarray.js";

function range(n: number) {
	return Array.from({ length: n }, (_, i) => i);
}

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("open (v2 vs v3 priority)", () => {
	function meta_store(
		entries: Record<
			AbsolutePath,
			ArrayMetadata | GroupMetadata | ArrayMetadataV2 | GroupMetadataV2
		>,
	): Map<AbsolutePath, Uint8Array> {
		let enc = new TextEncoder();
		let store = new Map<AbsolutePath, Uint8Array>();
		for (let [k, v] of Object.entries(entries)) {
			store.set(k as AbsolutePath, enc.encode(JSON.stringify(v)));
		}
		return store;
	}

	let store_root = () =>
		root(
			meta_store({
				"/v2/.zgroup": {
					zarr_format: 2,
				},
				"/v2/foo/.zarray": {
					zarr_format: 2,
					chunks: [2],
					shape: [4],
					compressor: null,
					dtype: "<i2",
					fill_value: 0,
					filters: null,
					order: "C",
				},
				"/v3/zarr.json": {
					zarr_format: 3,
					node_type: "group",
					attributes: {},
				},
				"/v3/foo/zarr.json": {
					zarr_format: 3,
					node_type: "array",
					data_type: "int32",
					shape: [4],
					chunk_grid: {
						name: "regular",
						configuration: {
							chunk_shape: [2],
						},
					},
					codecs: [],
					chunk_key_encoding: {
						name: "default",
						configuration: {
							separator: "/",
						},
					},
					fill_value: null,
					attributes: {},
				},
			}),
		);

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prioritizes v2 by default", async () => {
		let store = store_root();
		let v2_spy = vi.spyOn(open, "v2");
		let v3_spy = vi.spyOn(open, "v3");
		await open(store.resolve("v2/foo"));
		await open(store.resolve("v2"));
		expect(v2_spy).toHaveBeenCalledTimes(2);
		expect(v3_spy).toHaveBeenCalledTimes(0);
	});

	it("prioritizes v3 after opening v3 more times", async () => {
		let store = store_root();
		let v2_spy = vi.spyOn(open, "v2");
		let v3_spy = vi.spyOn(open, "v3");

		// Simulate opening v3 more times than v2
		await open(store.resolve("v3"));
		await open(store.resolve("v3"));
		await open(store.resolve("v3/foo"));

		// Assuming v2 is the default and tried first
		expect(v2_spy).toHaveBeenCalledTimes(1);
		expect(v3_spy).toHaveBeenCalledTimes(3);
	});

	it("switches back to prioritizing v2 after opening v2 more times", async () => {
		let store = store_root();
		let v2_spy = vi.spyOn(open, "v2");
		let v3_spy = vi.spyOn(open, "v3");

		// Simulate initial opening of v3
		await open(store.resolve("v3"));

		// Now, simulate opening v2 more times than v3
		await open(store.resolve("v2"));
		await open(store.resolve("v2/foo"));
		await open(store.resolve("v2"));

		expect(v2_spy).toHaveBeenCalledTimes(4);
		expect(v3_spy).toHaveBeenCalledTimes(2);
	});
});

describe("v2", () => {
	let store = root(
		new FileSystemStore(
			path.resolve(__dirname, "../../../fixtures/v2/data.zarr"),
		),
	);

	describe("loads .zattrs", () => {
		it.each([
			[undefined, { answer: 42 }],
			[true, { answer: 42 }],
			[false, {}],
		])("attrs: %j", async (attrs, expected) => {
			let group = await open.v2(store, { attrs });
			expect(group.attrs).toStrictEqual(expected);
		});
	});

	describe("1d.contiguous.i2", () => {
		it.each([
			"1d.contiguous.zlib.i2",
			"1d.contiguous.blosc.i2",
			"1d.contiguous.lz4.i2",
			"1d.contiguous.zstd.i2",
			"1d.contiguous.raw.i2",
		])("%s", async (path) => {
			let arr = await open.v2(store.resolve(path), { kind: "array" });
			expect(await arr.getChunk([0])).toStrictEqual({
				data: new Int16Array([1, 2, 3, 4]),
				shape: [4],
				stride: [1],
			});
		});
	});

	it("1d.contiguous.i4", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.i4"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Int32Array([1, 2, 3, 4]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.u1", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.u1"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Uint8Array([255, 0, 255, 0]),
			shape: [4],
			stride: [1],
		});
	});

	describe("1d.contiguous.f4", () => {
		it.each(["1d.contiguous.f4.le", "1d.contiguous.f4.be"])(
			"%s",
			async (path) => {
				let arr = await open.v2(store.resolve(path), { kind: "array" });
				expect(await arr.getChunk([0])).toStrictEqual({
					data: new Float32Array([-1000.5, 0, 1000.5, 0]),
					shape: [4],
					stride: [1],
				});
			},
		);
	});

	it("1d.contiguous.f8", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.f8"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Float64Array([1.5, 2.5, 3.5, 4.5]),
			shape: [4],
			stride: [1],
		});
	});

	describe("1d.contiguous.U13", () => {
		it.each(["1d.contiguous.U13.le", "1d.contiguous.U13.le"])(
			"%s",
			async (path) => {
				let arr = await open.v2(store.resolve(path), {
					kind: "array",
				});
				let chunk = await arr.getChunk([0]);
				expect(chunk.data).toBeInstanceOf(UnicodeStringArray);
				expect({ ...chunk, data: Array.from(chunk.data) }).toStrictEqual({
					data: ["a", "b", "cc", "d"],
					shape: [4],
					stride: [1],
				});
			},
		);
	});

	it("1d.contiguous.U7", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.U7"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(UnicodeStringArray);
		expect({ ...chunk, data: Array.from(chunk.data) }).toStrictEqual({
			data: ["a", "b", "cc", "d"],
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.S7", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.S7"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(ByteStringArray);
		expect({ ...chunk, data: Array.from(chunk.data) }).toStrictEqual({
			data: ["a", "b", "cc", "d"],
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.b1", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.b1"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(BoolArray);
		expect({ ...chunk, data: Array.from(chunk.data) }).toStrictEqual({
			data: [true, false, true, false],
			shape: [4],
			stride: [1],
		});
	});

	it("2d.contiguous.i2", async () => {
		let arr = await open.v2(store.resolve("/2d.contiguous.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0, 0])).toStrictEqual({
			data: new Int16Array([1, 2, 3, 4]),
			shape: [2, 2],
			stride: [2, 1],
		});
	});

	it("3d.contiguous.i2", async () => {
		let arr = await open.v2(store.resolve("/3d.contiguous.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0, 0, 0])).toStrictEqual({
			data: new Int16Array(range(27)),
			shape: [3, 3, 3],
			stride: [9, 3, 1],
		});
	});

	describe("1d.chunked.i2", async () => {
		let arr = await open.v2(store.resolve("/1d.chunked.i2"), {
			kind: "array",
		});
		it.each([
			[[0], [1, 2]],
			[[1], [3, 4]],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [2],
				stride: [1],
			});
		});
	});

	describe("1d.chunked.ragged.i2", async () => {
		let arr = await open.v2(store.resolve("/1d.chunked.ragged.i2"), {
			kind: "array",
		});
		it.each([
			[[0], [1, 2]],
			[[1], [3, 4]],
			[[2], [5, 0]],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [2],
				stride: [1],
			});
		});
	});

	describe("2d.chunked.i2", async () => {
		let arr = await open.v2(store.resolve("/2d.chunked.i2"), {
			kind: "array",
		});
		it.each([
			[[0, 0], [1]],
			[[0, 1], [2]],
			[[1, 0], [3]],
			[[1, 1], [4]],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [1, 1],
				stride: [1, 1],
			});
		});
	});

	describe("2d.chunked.U7", async () => {
		let arr = await open.v2(store.resolve("/2d.chunked.U7"), {
			kind: "array",
		});
		it.each([
			[[0, 0], ["a"]],
			[[0, 1], ["b"]],
			[[1, 0], ["cc"]],
			[[1, 1], ["d"]],
		])("getChunk(%j) -> %j", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk.data).toBeInstanceOf(UnicodeStringArray);
			expect({ ...chunk, data: Array.from(chunk.data) }).toStrictEqual({
				data: expected,
				shape: [1, 1],
				stride: [1, 1],
			});
		});
	});

	describe("2d.chunked.ragged.i2", async () => {
		let arr = await open.v2(store.resolve("/2d.chunked.ragged.i2"), {
			kind: "array",
		});
		it.each([
			[
				[0, 0],
				[1, 2, 4, 5],
			],
			[
				[0, 1],
				[3, 0, 6, 0],
			],
			[
				[1, 0],
				[7, 8, 0, 0],
			],
			[
				[1, 1],
				[9, 0, 0, 0],
			],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [2, 2],
				stride: [2, 1],
			});
		});
	});

	describe("3d.chunked.i2", async () => {
		let arr = await open.v2(store.resolve("/3d.chunked.i2"), {
			kind: "array",
		});
		it.each([
			[[0, 0, 0], [0]],
			[[0, 0, 2], [2]],
			[[1, 1, 1], [13]],
			[[2, 2, 2], [26]],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [1, 1, 1],
				stride: [1, 1, 1],
			});
		});
	});

	describe("3d.chunked.O", async () => {
		let arr = await open.v2(store.resolve("/3d.chunked.O"), {
			kind: "array",
		});
		it.each([
			[
				[0, 0, 0],
				["a", "aa"],
			],
			[
				[1, 0, 0],
				["b", "bb"],
			],
			[
				[0, 1, 0],
				["aaa", "aaaa"],
			],
			[
				[1, 1, 0],
				["bbb", "bbbb"],
			],
		])("getChunk(%j) -> %j", async (index, expected) => {
			expect(await arr.getChunk(index)).toStrictEqual({
				data: expected,
				shape: [1, 1, 2],
				stride: [2, 2, 1],
			});
		});
	});

	describe("3d.chunked.mixed.i2.C", async () => {
		let arr = await open.v2(store.resolve("/3d.chunked.mixed.i2.C"), {
			kind: "array",
		});
		it.each([
			[
				[0, 0, 0],
				[0, 3, 6, 9, 12, 15, 18, 21, 24],
			],
			[
				[0, 0, 1],
				[1, 4, 7, 10, 13, 16, 19, 22, 25],
			],
			[
				[0, 0, 2],
				[2, 5, 8, 11, 14, 17, 20, 23, 26],
			],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [3, 3, 1],
				stride: [3, 1, 1],
			});
		});
	});

	describe("3d.chunked.mixed.i2.F", async () => {
		let arr = await open.v2(store.resolve("/3d.chunked.mixed.i2.F"), {
			kind: "array",
		});
		it.each([
			[
				[0, 0, 0],
				[0, 9, 18, 3, 12, 21, 6, 15, 24],
			],
			[
				[0, 0, 1],
				[1, 10, 19, 4, 13, 22, 7, 16, 25],
			],
			[
				[0, 0, 2],
				[2, 11, 20, 5, 14, 23, 8, 17, 26],
			],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [3, 3, 1],
				stride: [1, 3, 9],
			});
		});
	});

	it("opens group from root", async () => {
		let grp = await open(store, { kind: "group" });
		expect(grp.path).toBe("/");
	});

	it("throws when group is not found", async () => {
		let try_open = () =>
			open.v2(store.resolve("/not/a/group"), { kind: "group" });
		await expect(try_open).rejects.toThrowError(NodeNotFoundError);
		await expect(try_open).rejects.toThrowErrorMatchingInlineSnapshot(
			"[NodeNotFoundError: Node not found: v2 group]",
		);
	});

	describe("opens array from group", async () => {
		let grp = await open.v2(store, { kind: "group" });
		it.each(["/1d.chunked.i2", "1d.chunked.i2"])("%s", async (path) => {
			let a = await open.v2(grp.resolve(path), { kind: "array" });
			expect(a.path).toBe("/1d.chunked.i2");
		});
	});
});

describe("v3", () => {
	let store = root(
		new FileSystemStore(
			path.resolve(__dirname, "../../../fixtures/v3/data.zarr"),
		),
	);

	describe("1d.contiguous.i2", async () => {
		it.each([
			"1d.contiguous.gzip.i2",
			"1d.contiguous.blosc.i2",
			"1d.contiguous.raw.i2",
		])("%s", async (path) => {
			let arr = await open.v3(store.resolve(path), { kind: "array" });
			expect(await arr.getChunk([0])).toStrictEqual({
				data: new Int16Array([1, 2, 3, 4]),
				shape: [4],
				stride: [1],
			});
		});
	});

	it("1d.contiguous.i4", async () => {
		let arr = await open.v3(store.resolve("/1d.contiguous.i4"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Int32Array([1, 2, 3, 4]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.u1", async () => {
		let arr = await open.v3(store.resolve("/1d.contiguous.u1"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Uint8Array([255, 0, 255, 0]),
			shape: [4],
			stride: [1],
		});
	});

	describe("1d.contiguous.f2", () => {
		describe("with Float16Array", () => {
			beforeAll(() => {
				vi.stubGlobal("Float16Array", globalThis.Float16Array ?? Float16Array);
			});
			afterAll(() => {
				vi.unstubAllGlobals();
			});
			it("1d.contiguous.f2.le", async () => {
				let arr = await open.v3(store.resolve("1d.contiguous.f2.le"), {
					kind: "array",
				});
				expect(await arr.getChunk([0])).toStrictEqual({
					data: new (globalThis.Float16Array ?? Float16Array)([
						-1000.5, 0, 1000.5, 0,
					]),
					shape: [4],
					stride: [1],
				});
			});
		});
		describe("without Float16Array", () => {
			beforeAll(() => {
				vi.stubGlobal("Float16Array", undefined);
			});
			afterAll(() => {
				vi.unstubAllGlobals();
			});
			it("1d.contiguous.f2.le", async () => {
				await expect(() =>
					open.v3(store.resolve("1d.contiguous.f2.le"), { kind: "array" }),
				).rejects.toThrowError();
			});
		});
	});

	describe("1d.contiguous.f4", () => {
		it.each(["1d.contiguous.f4.le", "1d.contiguous.f4.be"])(
			"%s",
			async (path) => {
				let arr = await open.v3(store.resolve(path), { kind: "array" });
				expect(await arr.getChunk([0])).toStrictEqual({
					data: new Float32Array([-1000.5, 0, 1000.5, 0]),
					shape: [4],
					stride: [1],
				});
			},
		);
	});

	it("1d.contiguous.f8", async () => {
		let arr = await open.v3(store.resolve("/1d.contiguous.f8"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Float64Array([1.5, 2.5, 3.5, 4.5]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.b1", async () => {
		let arr = await open.v3(store.resolve("/1d.contiguous.b1"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(BoolArray);
		expect({ ...chunk, data: Array.from(chunk.data) }).toStrictEqual({
			data: [true, false, true, false],
			shape: [4],
			stride: [1],
		});
	});

	it("2d.contiguous.i2", async () => {
		let arr = await open.v3(store.resolve("/2d.contiguous.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0, 0])).toStrictEqual({
			data: new Int16Array([1, 2, 3, 4]),
			shape: [2, 2],
			stride: [2, 1],
		});
	});

	it("3d.contiguous.i2", async () => {
		let arr = await open.v3(store.resolve("/3d.contiguous.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0, 0, 0])).toStrictEqual({
			data: new Int16Array(range(27)),
			shape: [3, 3, 3],
			stride: [9, 3, 1],
		});
	});

	describe("1d.chunked.i2", async () => {
		let arr = await open.v3(store.resolve("/1d.chunked.i2"), {
			kind: "array",
		});
		it.each([
			[[0], [1, 2]],
			[[1], [3, 4]],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [2],
				stride: [1],
			});
		});
	});

	describe("1d.chunked.ragged.i2", async () => {
		let arr = await open.v3(store.resolve("/1d.chunked.ragged.i2"), {
			kind: "array",
		});
		it.each([
			[[0], [1, 2]],
			[[1], [3, 4]],
			[[2], [5, 0]],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [2],
				stride: [1],
			});
		});
	});

	describe("2d.chunked.i2", async () => {
		let arr = await open.v3(store.resolve("/2d.chunked.i2"), {
			kind: "array",
		});
		it.each([
			[[0, 0], [1]],
			[[0, 1], [2]],
			[[1, 0], [3]],
			[[1, 1], [4]],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [1, 1],
				stride: [1, 1],
			});
		});
	});

	describe("2d.chunked.ragged.i2", async () => {
		let arr = await open.v3(store.resolve("/2d.chunked.ragged.i2"), {
			kind: "array",
		});
		it.each([
			[
				[0, 0],
				[1, 2, 4, 5],
			],
			[
				[0, 1],
				[3, 0, 6, 0],
			],
			[
				[1, 0],
				[7, 8, 0, 0],
			],
			[
				[1, 1],
				[9, 0, 0, 0],
			],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [2, 2],
				stride: [2, 1],
			});
		});
	});

	describe("3d.chunked.i2", async () => {
		let arr = await open.v3(store.resolve("/3d.chunked.i2"), {
			kind: "array",
		});
		it.each([
			[[0, 0, 2], [2]],
			[[1, 1, 1], [13]],
			[[2, 2, 2], [26]],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [1, 1, 1],
				stride: [1, 1, 1],
			});
		});
	});

	describe("3d.chunked.mixed.i2.C", async () => {
		let arr = await open.v3(store.resolve("/3d.chunked.mixed.i2.C"), {
			kind: "array",
		});
		it.each([
			[
				[0, 0, 0],
				[0, 3, 6, 9, 12, 15, 18, 21, 24],
			],
			[
				[0, 0, 1],
				[1, 4, 7, 10, 13, 16, 19, 22, 25],
			],
			[
				[0, 0, 2],
				[2, 5, 8, 11, 14, 17, 20, 23, 26],
			],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [3, 3, 1],
				stride: [3, 1, 1],
			});
		});
	});

	describe("3d.chunked.mixed.i2.F", async () => {
		let arr = await open.v3(store.resolve("/3d.chunked.mixed.i2.F"), {
			kind: "array",
		});
		it.each([
			[
				[0, 0, 0],
				[0, 9, 18, 3, 12, 21, 6, 15, 24],
			],
			[
				[0, 0, 1],
				[1, 10, 19, 4, 13, 22, 7, 16, 25],
			],
			[
				[0, 0, 2],
				[2, 11, 20, 5, 14, 23, 8, 17, 26],
			],
		])("getChunk(%j) -> Int16Array(%j)", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: new Int16Array(expected),
				shape: [3, 3, 1],
				stride: [1, 3, 9],
			});
		});
	});

	it("opens group from root", async () => {
		let grp = await open.v3(store, { kind: "group" });
		expect(grp.path).toBe("/");
	});

	it("throws when group not found", async () => {
		const try_open = () =>
			open.v3(store.resolve("/not/a/group"), { kind: "group" });
		await expect(try_open).rejects.toThrowError(NodeNotFoundError);
		await expect(try_open).rejects.toThrowErrorMatchingInlineSnapshot(
			"[NodeNotFoundError: Node not found: v3 array or group]",
		);
	});

	describe("opens array from group", async () => {
		let grp = await open.v3(store, { kind: "group" });
		it.each(["/1d.chunked.i2", "1d.chunked.i2"])("%s", async (path) => {
			let a = await open.v3(grp.resolve(path), { kind: "array" });
			expect(a.path).toBe("/1d.chunked.i2");
		});
	});

	it("1d.contiguous.compressed.sharded.i2", async () => {
		let arr = await open.v3(
			store.resolve("1d.contiguous.compressed.sharded.i2"),
			{ kind: "array" },
		);
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Int16Array([1, 2, 3, 4]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.compressed.sharded.i4", async () => {
		let arr = await open.v3(
			store.resolve("1d.contiguous.compressed.sharded.i4"),
			{ kind: "array" },
		);
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Int32Array([1, 2, 3, 4]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.compressed.sharded.u1", async () => {
		let arr = await open.v3(
			store.resolve("1d.contiguous.compressed.sharded.u1"),
			{ kind: "array" },
		);
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Uint8Array([255, 0, 255, 0]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.compressed.sharded.f4", async () => {
		let arr = await open.v3(
			store.resolve("1d.contiguous.compressed.sharded.f4"),
			{ kind: "array" },
		);
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Float32Array([-1000.5, 0, 1000.5, 0]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.compressed.sharded.f8", async () => {
		let arr = await open.v3(
			store.resolve("1d.contiguous.compressed.sharded.f8"),
			{ kind: "array" },
		);
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Float64Array([1.5, 2.5, 3.5, 4.5]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.compressed.sharded.b1", async () => {
		let arr = await open.v3(
			store.resolve("1d.contiguous.compressed.sharded.b1"),
			{ kind: "array" },
		);
		let chunk = await arr.getChunk([0]);
		expect({
			...chunk,
			data: Array.from(chunk.data),
		}).toStrictEqual({
			data: [true, false, true, false],
			shape: [4],
			stride: [1],
		});
	});

	describe("1d.chunked.compressed.sharded.i2", async () => {
		let arr = await open.v3(store.resolve("1d.chunked.compressed.sharded.i2"), {
			kind: "array",
		});
		it.each<[chunk_coord: [number], value: number]>([
			[[0], 1],
			[[1], 2],
			[[2], 3],
			[[3], 4],
		])("getChunk(%j) -> Int16Array([%i])", async (chunk_coord, expected) => {
			expect(await arr.getChunk(chunk_coord)).toStrictEqual({
				data: new Int16Array([expected]),
				shape: [1],
				stride: [1],
			});
		});
	});

	describe("1d.chunked.filled.compressed.sharded.i2", async () => {
		let arr = await open.v3(
			store.resolve("1d.chunked.filled.compressed.sharded.i2"),
			{ kind: "array" },
		);
		it.each<[chunk_coord: [number], value: number]>([
			[[0], 1],
			[[1], 2],
			[[2], 0],
			[[3], 0],
		])("getChunk(%j) -> Int16Array([%i])", async (chunk_coord, expected) => {
			expect(await arr.getChunk(chunk_coord)).toStrictEqual({
				data: new Int16Array([expected]),
				shape: [1],
				stride: [1],
			});
		});
	});

	describe("2d.contiguous.compressed.sharded.i2", async () => {
		let arr = await open.v3(store.resolve("2d.chunked.compressed.sharded.i2"), {
			kind: "array",
		});
		it.each<[chunk_coord: [i: number, j: number], value: number]>([
			[[0, 0], 1],
			[[0, 1], 2],
			[[0, 2], 3],
			[[0, 3], 4],
			[[1, 0], 5],
			[[1, 1], 6],
			[[1, 2], 7],
			[[1, 3], 8],
			[[2, 0], 9],
			[[2, 1], 10],
			[[2, 2], 11],
			[[2, 3], 12],
			[[3, 0], 13],
			[[3, 1], 14],
			[[3, 2], 15],
			[[3, 3], 16],
		])("getChunk(%j) -> Int16Array([%i])", async (chunk_coords, expected) => {
			expect(await arr.getChunk(chunk_coords)).toStrictEqual({
				data: new Int16Array([expected]),
				shape: [1, 1],
				stride: [1, 1],
			});
		});
	});

	describe("2d.chunked.compressed.sharded.filled.i2", async () => {
		let arr = await open.v3(
			store.resolve("2d.chunked.compressed.sharded.filled.i2"),
			{ kind: "array" },
		);
		it.each<[chunk_coord: [number, number], value: number]>([
			[[0, 0], 0],
			[[0, 1], 1],
			[[0, 2], 2],
			[[0, 3], 3],
			[[1, 0], 4],
			[[1, 1], 5],
			[[1, 2], 6],
			[[1, 3], 7],
			[[2, 0], 8],
			[[2, 1], 9],
			[[2, 2], 10],
			[[2, 3], 11],
			[[3, 0], 12],
			[[3, 1], 13],
			[[3, 2], 14],
			[[3, 3], 15],
		])("getChunk(%j) -> Int32Array([%i])", async (chunk_coord, expected) => {
			expect(await arr.getChunk(chunk_coord)).toStrictEqual({
				data: new Int16Array([expected]),
				shape: [1, 1],
				stride: [1, 1],
			});
		});
	});

	describe("2d.chunked.compressed.sharded.i2", async () => {
		let arr = await open.v3(store.resolve("2d.chunked.compressed.sharded.i2"), {
			kind: "array",
		});
		it.each<[chunk_coord: [number, number], value: number]>([
			[[0, 0], 1],
			[[0, 1], 2],
			[[0, 2], 3],
			[[0, 3], 4],
			[[1, 0], 5],
			[[1, 1], 6],
			[[1, 2], 7],
			[[1, 3], 8],
			[[2, 0], 9],
			[[2, 1], 10],
			[[2, 2], 11],
			[[2, 3], 12],
			[[3, 0], 13],
			[[3, 1], 14],
			[[3, 2], 15],
			[[3, 3], 16],
		])("getChunk(%j) -> Int32Array([%i])", async (chunk_coord, expected) => {
			expect(await arr.getChunk(chunk_coord)).toStrictEqual({
				data: new Int16Array([expected]),
				shape: [1, 1],
				stride: [1, 1],
			});
		});
	});

	it("3d.contiguous.compressed.sharded.i2", async () => {
		let arr = await open.v3(
			store.resolve("3d.contiguous.compressed.sharded.i2"),
			{ kind: "array" },
		);
		expect(await arr.getChunk([0, 0, 0])).toStrictEqual({
			data: new Int16Array(Array.from({ length: 27 }, (_, i) => i)),
			shape: [3, 3, 3],
			stride: [9, 3, 1],
		});
	});

	describe("3d.chunked.compressed.sharded.i2", async () => {
		let arr = await open.v3(store.resolve("3d.chunked.compressed.sharded.i2"), {
			kind: "array",
		});
		it.each<[chunk_coord: [number, number, number], value: number]>([
			[[0, 0, 0], 0],
			[[1, 0, 1], 17],
			[[2, 0, 0], 32],
			[[1, 1, 1], 21],
			[[1, 3, 2], 30],
			[[3, 3, 3], 63],
		])("getChunk(%j) –> Int16Array([%i])", async (chunk_coords, expected) => {
			expect(await arr.getChunk(chunk_coords)).toStrictEqual({
				data: new Int16Array([expected]),
				shape: [1, 1, 1],
				stride: [1, 1, 1],
			});
		});
	});

	describe("3d.chunked.mixed.compressed.sharded.i2", async () => {
		let arr = await open.v3(
			store.resolve("3d.chunked.mixed.compressed.sharded.i2"),
			{ kind: "array" },
		);
		it.each<[chunk_coord: [number, number, number], value: number[]]>([
			[
				[0, 0, 0],
				[0, 3, 6, 9, 12, 15, 18, 21, 24],
			],
			[
				[0, 0, 1],
				[1, 4, 7, 10, 13, 16, 19, 22, 25],
			],
			[
				[0, 0, 2],
				[2, 5, 8, 11, 14, 17, 20, 23, 26],
			],
		])("getChunk(%j) -> Int16Array([%i])", async (chunk_coord, expected) => {
			expect(await arr.getChunk(chunk_coord)).toStrictEqual({
				data: new Int16Array(expected),
				shape: [3, 3, 1],
				stride: [3, 1, 1],
			});
		});
	});
});
