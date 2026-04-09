import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import { Float16Array } from "@petamoriken/float16";
import {
	type AbsolutePath,
	FileSystemStore,
	ZipFileStore,
} from "@zarrita/storage";
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

	it("falls back to v3 when v2 metadata is not valid JSON", async () => {
		let enc = new TextEncoder();
		let store = new Map();
		// Simulate a server that returns non-JSON (e.g., HTML error page) for v2 keys
		store.set("/.zattrs", enc.encode("<html>Not Found</html>"));
		store.set(
			"/zarr.json",
			enc.encode(
				JSON.stringify({
					zarr_format: 3,
					node_type: "group",
					attributes: {},
				}),
			),
		);
		let node = await open(root(store));
		expect(node.attrs).toStrictEqual({});
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
		it.each([
			"1d.contiguous.f4.le",
			"1d.contiguous.f4.be",
		])("%s", async (path) => {
			let arr = await open.v2(store.resolve(path), { kind: "array" });
			expect(await arr.getChunk([0])).toStrictEqual({
				data: new Float32Array([-1000.5, 0, 1000.5, 0]),
				shape: [4],
				stride: [1],
			});
		});
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
		it.each([
			"1d.contiguous.U13.le",
			"1d.contiguous.U13.le",
		])("%s", async (path) => {
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
		});
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

	it("1d.contiguous.shuffle.i2", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.shuffle.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Int16Array([1, 2, 3, 4]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.delta.i2", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.delta.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Int16Array([1, 2, 3, 4]),
			shape: [4],
			stride: [1],
		});
	});

	it("1d.contiguous.delta.shuffle.i2", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.delta.shuffle.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Int16Array([10, 20, 30, 40]),
			shape: [4],
			stride: [1],
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

	it("exposes fillValue on array", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.i4"), {
			kind: "array",
		});
		expect(arr.fillValue).toBe(0);
	});
});

describe("fillValue with IEEE 754 special values", () => {
	function v2_store(fill_value: unknown) {
		let enc = new TextEncoder();
		let store = new Map<string, Uint8Array>();
		store.set(
			"/.zarray" as AbsolutePath,
			enc.encode(
				JSON.stringify({
					zarr_format: 2,
					chunks: [2],
					shape: [4],
					compressor: null,
					dtype: "<f4",
					fill_value,
					filters: null,
					order: "C",
				}),
			),
		);
		return store;
	}

	it.each([
		["NaN", NaN],
		["Infinity", Infinity],
		["-Infinity", -Infinity],
	])("v2: %s", async (json_value, expected) => {
		let arr = await open.v2(root(v2_store(json_value)), { kind: "array" });
		expect(arr.fillValue).toBe(expected);
	});
});

describe("v3", async () => {
	let store = root(
		new FileSystemStore(
			path.resolve(__dirname, "../../../fixtures/v3/data.zarr"),
		),
	);

	let zip_buffer = await fs.readFile(
		path.resolve(
			__dirname,
			"../../../fixtures/v3/data.zipped_from_within.zarr.zip",
		),
	);
	let blob = new Blob([zip_buffer], { type: "application/zip" });
	let zip_store = root(ZipFileStore.fromBlob(blob));

	describe("supports spaces in key paths", async () => {
		it("can be opened from FileSystemStore", async () => {
			let grp = await open.v3(store.resolve("/my group with spaces"), {
				kind: "group",
			});
			expect(grp.attrs).toStrictEqual({
				description: "A group with spaces in the name",
			});
		});
		it("can be opened from ZipFileStore", async () => {
			let grp = await open.v3(zip_store.resolve("/my group with spaces"), {
				kind: "group",
			});
			expect(grp.attrs).toStrictEqual({
				description: "A group with spaces in the name",
			});
		});
	});

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

	it("1d.contiguous.delta.i4", async () => {
		let arr = await open.v3(store.resolve("/1d.contiguous.delta.i4"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toStrictEqual({
			data: new Int32Array([1, 2, 3, 4]),
			shape: [4],
			stride: [1],
		});
	});

	it("3d.contiguous.delta.i4.mixed", async () => {
		// TransposeCodec([1,0,2]) swaps first two axes via stride metadata.
		// stride [3,9,1] means arr[i,j,k] = data[3*i + 9*j + k], correctly reconstructing arange(27).
		const expectedData = new Int32Array(27);
		let n = 0;
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 3; j++) {
				for (let k = 0; k < 3; k++) {
					expectedData[i * 3 + j * 9 + k] = n++;
				}
			}
		}
		let arr = await open.v3(store.resolve("/3d.contiguous.delta.i4.mixed"), {
			kind: "array",
		});

		expect(await arr.getChunk([0, 0, 0])).toStrictEqual({
			data: expectedData,
			shape: [3, 3, 3],
			stride: [3, 9, 1],
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
		it.each([
			"1d.contiguous.f4.le",
			"1d.contiguous.f4.be",
		])("%s", async (path) => {
			let arr = await open.v3(store.resolve(path), { kind: "array" });
			expect(await arr.getChunk([0])).toStrictEqual({
				data: new Float32Array([-1000.5, 0, 1000.5, 0]),
				shape: [4],
				stride: [1],
			});
		});
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

	describe("1d.contiguous.string.vlen", async () => {
		let arr = await open.v3(store.resolve("/1d.contiguous.string.vlen"), {
			kind: "array",
		});

		it("has correct metadata", () => {
			expect(arr.dtype).toBe("string");
			expect(arr.shape).toEqual([4]);
		});

		it("reads string data", async () => {
			let chunk = await arr.getChunk([0]);
			expect(chunk).toStrictEqual({
				data: ["hello", "world", "zarr", "v3"],
				shape: [4],
				stride: [1],
			});
		});
	});

	describe("1d.chunked.string.vlen", async () => {
		let arr = await open.v3(store.resolve("/1d.chunked.string.vlen"), {
			kind: "array",
		});

		it.each([
			[[0], ["a", "bb"]],
			[[1], ["ccc", "dddd"]],
		])("getChunk(%j) -> %j", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: expected,
				shape: [2],
				stride: [1],
			});
		});
	});

	describe("2d.chunked.string.vlen", async () => {
		let arr = await open.v3(store.resolve("/2d.chunked.string.vlen"), {
			kind: "array",
		});

		it.each([
			[
				[0, 0],
				["hello", "world"],
			],
			[
				[1, 0],
				["foo", "bar"],
			],
		])("getChunk(%j) -> %j", async (index, expected) => {
			let chunk = await arr.getChunk(index);
			expect(chunk).toStrictEqual({
				data: expected,
				shape: [1, 2],
				stride: [2, 1],
			});
		});
	});

	describe("string edge cases", () => {
		it("handles empty strings", async () => {
			let arr = await open.v3(store.resolve("/1d.string.empty"), {
				kind: "array",
			});
			let chunk = await arr.getChunk([0]);
			expect(chunk.data).toEqual(["", "test", ""]);
		});

		it("handles unicode characters", async () => {
			let arr = await open.v3(store.resolve("/1d.string.unicode"), {
				kind: "array",
			});
			let chunk = await arr.getChunk([0]);
			expect(chunk.data).toEqual(["hello", "世界", "🚀🎉", "Ñoño"]);
		});
	});

	it("deduplicates concurrent shard index fetches", async () => {
		let fs_store = new FileSystemStore(
			path.resolve(__dirname, "../../../fixtures/v3/data.zarr"),
		);
		let spy = vi.spyOn(fs_store, "getRange");
		// 2d.chunked.compressed.sharded.i2: shape [4,4], shard [2,2], inner [1,1]
		// chunks [0,0],[0,1],[1,0],[1,1] are all in shard c/0/0
		let arr = await open.v3(
			root(fs_store).resolve("2d.chunked.compressed.sharded.i2"),
			{
				kind: "array",
			},
		);
		spy.mockClear();
		// Read 4 chunks from the same shard concurrently
		let results = await Promise.all([
			arr.getChunk([0, 0]),
			arr.getChunk([0, 1]),
			arr.getChunk([1, 0]),
			arr.getChunk([1, 1]),
		]);
		expect(results[0].data).toStrictEqual(new Int16Array([1]));
		expect(results[1].data).toStrictEqual(new Int16Array([2]));
		expect(results[2].data).toStrictEqual(new Int16Array([5]));
		expect(results[3].data).toStrictEqual(new Int16Array([6]));
		// Count suffix range requests (shard index fetches)
		let suffix_calls = spy.mock.calls.filter(
			(call) => call[1] && "suffixLength" in call[1],
		);
		expect(suffix_calls).toHaveLength(1);
		spy.mockRestore();
	});

	it("evicts cached shard index on fetch failure and retries", async () => {
		let fs_store = new FileSystemStore(
			path.resolve(__dirname, "../../../fixtures/v3/data.zarr"),
		);
		if (!fs_store.getRange)
			throw new Error("FileSystemStore must support getRange");
		let original = fs_store.getRange.bind(fs_store);
		let call_count = 0;
		vi.spyOn(fs_store, "getRange").mockImplementation((key, range) => {
			call_count++;
			// Fail the first suffix range request (shard index), pass the rest
			if (call_count === 1 && range && "suffixLength" in range) {
				return Promise.reject(new Error("transient network error"));
			}
			return original(key, range);
		});
		let arr = await open.v3(
			root(fs_store).resolve("2d.chunked.compressed.sharded.i2"),
			{ kind: "array" },
		);
		call_count = 0;
		// First read should fail
		await expect(arr.getChunk([0, 0])).rejects.toThrow(
			"transient network error",
		);
		// Retry should succeed (cache evicted the failed Promise)
		let chunk = await arr.getChunk([0, 0]);
		expect(chunk.data).toStrictEqual(new Int16Array([1]));
	});

	describe("sharded arrays from ZipFileStore (uncompressed)", async () => {
		let uncompressed_zip_buffer = await fs.readFile(
			path.resolve(
				__dirname,
				"../../../fixtures/v3/data.uncompressed.zarr.zip",
			),
		);
		let blob = new Blob([uncompressed_zip_buffer], { type: "application/zip" });
		let uncompressed_zip_store = root(ZipFileStore.fromBlob(blob));

		it("reads 1d.contiguous.compressed.sharded.i2 from uncompressed zip", async () => {
			let arr = await open.v3(
				uncompressed_zip_store.resolve("1d.contiguous.compressed.sharded.i2"),
				{ kind: "array" },
			);
			expect(await arr.getChunk([0])).toStrictEqual({
				data: new Int16Array([1, 2, 3, 4]),
				shape: [4],
				stride: [1],
			});
		});

		it("reads 1d.chunked.compressed.sharded.i2 from uncompressed zip", async () => {
			let arr = await open.v3(
				uncompressed_zip_store.resolve("1d.chunked.compressed.sharded.i2"),
				{ kind: "array" },
			);
			expect(await arr.getChunk([0])).toStrictEqual({
				data: new Int16Array([1]),
				shape: [1],
				stride: [1],
			});
			expect(await arr.getChunk([2])).toStrictEqual({
				data: new Int16Array([3]),
				shape: [1],
				stride: [1],
			});
		});

		it("reads 2d.chunked.compressed.sharded.i2 from uncompressed zip", async () => {
			let arr = await open.v3(
				uncompressed_zip_store.resolve("2d.chunked.compressed.sharded.i2"),
				{ kind: "array" },
			);
			expect(await arr.getChunk([1, 2])).toStrictEqual({
				data: new Int16Array([7]),
				shape: [1, 1],
				stride: [1, 1],
			});
		});

		it("reads 3d.chunked.compressed.sharded.i2 from uncompressed zip", async () => {
			let arr = await open.v3(
				uncompressed_zip_store.resolve("3d.chunked.compressed.sharded.i2"),
				{ kind: "array" },
			);
			expect(await arr.getChunk([1, 1, 1])).toStrictEqual({
				data: new Int16Array([21]),
				shape: [1, 1, 1],
				stride: [1, 1, 1],
			});
		});
	});
});
