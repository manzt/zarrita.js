import { describe, expect, it } from "vitest";
import * as url from "node:url";
import * as path from "node:path";
import { FileSystemStore } from "@zarrita/storage";
import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";

import { open } from "../src/open.js";
import { root } from "../src/hierarchy.js";
import { NodeNotFoundError } from "../src/errors.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe("v2", () => {
	let store = root(
		new FileSystemStore(
			path.resolve(__dirname, "../../../fixtures/v2/data.zarr"),
		),
	);

	it("loads .zattrs by default", async () => {
		let group = await open.v2(store);
		expect(group.attrs).toMatchInlineSnapshot(`
			{
			  "answer": 42,
			}
		`);
	});

	it("loads .zattrs when specified", async () => {
		let group = await open.v2(store, { attrs: true });
		expect(group.attrs).toMatchInlineSnapshot(`
			{
			  "answer": 42,
			}
		`);
	});

	it("skips loading .zattrs when disabled", async () => {
		let group = await open.v2(store, { attrs: false });
		expect(group.attrs).toMatchInlineSnapshot("{}");
	});

	it("1d.contiguous.zlib.i2", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.zlib.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.blosc.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.lz4.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.zstd.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.raw.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.i4"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.u1"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.f4.le"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.f4.be"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.f8"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.contiguous.U13.le"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(UnicodeStringArray);
		expect(Array.from(chunk.data as UnicodeStringArray)).toStrictEqual([
			"a",
			"b",
			"cc",
			"d",
		]);
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.U13.be", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.U13.be"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(UnicodeStringArray);
		expect(Array.from(chunk.data as UnicodeStringArray)).toStrictEqual([
			"a",
			"b",
			"cc",
			"d",
		]);
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.U7", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.U7"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(UnicodeStringArray);
		expect(Array.from(chunk.data as UnicodeStringArray)).toStrictEqual([
			"a",
			"b",
			"cc",
			"d",
		]);
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.S7", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.S7"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk.data).toBeInstanceOf(ByteStringArray);
		expect(Array.from(chunk.data as ByteStringArray)).toStrictEqual([
			"a",
			"b",
			"cc",
			"d",
		]);
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.b1", async () => {
		let arr = await open.v2(store.resolve("/1d.contiguous.b1"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk).toMatchInlineSnapshot(`
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
		expect(Array.from(chunk.data as BoolArray)).toMatchInlineSnapshot(`
			[
			  true,
			  false,
			  true,
			  false,
			]
		`);
	});

	it("2d.contiguous.i2", async () => {
		let arr = await open.v2(store.resolve("/2d.contiguous.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0, 0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/3d.contiguous.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0, 0, 0])).toMatchInlineSnapshot(`
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
		let arr = await open.v2(store.resolve("/1d.chunked.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0]),
			arr.getChunk([1]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      1,
			      2,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      3,
			      4,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			]
		`);
	});

	it("1d.chunked.ragged.i2", async () => {
		let arr = await open.v2(store.resolve("/1d.chunked.ragged.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0]),
			arr.getChunk([1]),
			arr.getChunk([2]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      1,
			      2,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      3,
			      4,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      5,
			      0,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			]
		`);
	});

	it("2d.chunked.i2", async () => {
		let arr = await open.v2(store.resolve("/2d.chunked.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0, 0]),
			arr.getChunk([0, 1]),
			arr.getChunk([1, 0]),
			arr.getChunk([1, 1]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      1,
			    ],
			    "shape": [
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      2,
			    ],
			    "shape": [
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      3,
			    ],
			    "shape": [
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      4,
			    ],
			    "shape": [
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			    ],
			  },
			]
		`);
	});

	it("2d.chunked.U7", async () => {
		let arr = await open.v2(store.resolve("/2d.chunked.U7"), {
			kind: "array",
		});
		let [c1, c2, c3, c4] = await Promise.all([
			arr.getChunk([0, 0]),
			arr.getChunk([0, 1]),
			arr.getChunk([1, 0]),
			arr.getChunk([1, 1]),
		]);
		expect(Array.from(c1.data as UnicodeStringArray)).toStrictEqual(["a"]);
		expect(c1.shape).toStrictEqual([1, 1]);
		expect(Array.from(c2.data as UnicodeStringArray)).toStrictEqual(["b"]);
		expect(c2.shape).toStrictEqual([1, 1]);
		expect(Array.from(c3.data as UnicodeStringArray)).toStrictEqual(["cc"]);
		expect(c3.shape).toStrictEqual([1, 1]);
		expect(Array.from(c4.data as UnicodeStringArray)).toStrictEqual(["d"]);
		expect(c4.shape).toStrictEqual([1, 1]);
	});

	it("2d.chunked.ragged.i2", async () => {
		let arr = await open.v2(store.resolve("/2d.chunked.ragged.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0, 0]),
			arr.getChunk([0, 1]),
			arr.getChunk([1, 0]),
			arr.getChunk([1, 1]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      1,
			      2,
			      4,
			      5,
			    ],
			    "shape": [
			      2,
			      2,
			    ],
			    "stride": [
			      2,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      3,
			      0,
			      6,
			      0,
			    ],
			    "shape": [
			      2,
			      2,
			    ],
			    "stride": [
			      2,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      7,
			      8,
			      0,
			      0,
			    ],
			    "shape": [
			      2,
			      2,
			    ],
			    "stride": [
			      2,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      9,
			      0,
			      0,
			      0,
			    ],
			    "shape": [
			      2,
			      2,
			    ],
			    "stride": [
			      2,
			      1,
			    ],
			  },
			]
		`);
	});

	it("3d.chunked.i2", async () => {
		let arr = await open.v2(store.resolve("/3d.chunked.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0, 0, 0]),
			arr.getChunk([0, 0, 2]),
			arr.getChunk([1, 1, 1]),
			arr.getChunk([2, 2, 2]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      0,
			    ],
			    "shape": [
			      1,
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      2,
			    ],
			    "shape": [
			      1,
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      13,
			    ],
			    "shape": [
			      1,
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      26,
			    ],
			    "shape": [
			      1,
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			      1,
			    ],
			  },
			]
		`);
	});

	it("3d.chunked.mixed.i2.C", async () => {
		let arr = await open.v2(store.resolve("/3d.chunked.mixed.i2.C"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0, 0, 0]),
			arr.getChunk([0, 0, 1]),
			arr.getChunk([0, 0, 2]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      0,
			      3,
			      6,
			      9,
			      12,
			      15,
			      18,
			      21,
			      24,
			    ],
			    "shape": [
			      3,
			      3,
			      1,
			    ],
			    "stride": [
			      3,
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      1,
			      4,
			      7,
			      10,
			      13,
			      16,
			      19,
			      22,
			      25,
			    ],
			    "shape": [
			      3,
			      3,
			      1,
			    ],
			    "stride": [
			      3,
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      2,
			      5,
			      8,
			      11,
			      14,
			      17,
			      20,
			      23,
			      26,
			    ],
			    "shape": [
			      3,
			      3,
			      1,
			    ],
			    "stride": [
			      3,
			      1,
			      1,
			    ],
			  },
			]
		`);
	});

	it("3d.chunked.mixed.i2.F", async () => {
		let arr = await open.v2(store.resolve("/3d.chunked.mixed.i2.F"), {
			kind: "array",
		});
		let [c1, c2, c3] = await Promise.all([
			arr.getChunk([0, 0, 0]),
			arr.getChunk([0, 0, 1]),
			arr.getChunk([0, 0, 2]),
		]);
		let shape = [3, 3, 1];
		let stride = [1, 3, 9];
		expect(c1.data).toStrictEqual(
			new Int16Array([0, 9, 18, 3, 12, 21, 6, 15, 24]),
		);
		expect(c1.shape).toStrictEqual(shape);
		expect(c1.stride).toStrictEqual(stride);
		expect(c2.data).toStrictEqual(
			new Int16Array([1, 10, 19, 4, 13, 22, 7, 16, 25]),
		);
		expect(c2.shape).toStrictEqual(shape);
		expect(c2.stride).toStrictEqual(stride);
		expect(c3.data).toStrictEqual(
			new Int16Array([2, 11, 20, 5, 14, 23, 8, 17, 26]),
		);
		expect(c3.shape).toStrictEqual(shape);
		expect(c3.stride).toStrictEqual(stride);
	});

	it("opens group from root", async () => {
		let grp = await open(store, { kind: "group" });
		expect(grp.path).toBe("/");
	});

	it("throws when group is not found", async () => {
		await expect(open.v2(store.resolve("/not/a/group"), { kind: "group" }))
			.rejects
			.toThrow(NodeNotFoundError);
	});

	it("opens array from group", async () => {
		let grp = await open.v2(store, { kind: "group" });
		let a1 = await open.v2(store.resolve("/1d.chunked.i2"), {
			kind: "array",
		});
		let a2 = await open.v2(grp.resolve("1d.chunked.i2"), {
			kind: "array",
		});
		expect(a1.path).toBe("/1d.chunked.i2");
		expect(a2.path).toBe("/1d.chunked.i2");
	});
});

describe("v3", () => {
	let store = root(
		new FileSystemStore(
			path.resolve(__dirname, "../../../fixtures/v3/data.zarr"),
		),
	);

	it("1d.contiguous.gzip.i2", async () => {
		let arr = await open.v3(store.resolve("/1d.contiguous.gzip.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v3(store.resolve("/1d.contiguous.blosc.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v3(store.resolve("/1d.contiguous.raw.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v3(store.resolve("/1d.contiguous.i4"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v3(store.resolve("/1d.contiguous.u1"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v3(store.resolve("/1d.contiguous.f4.le"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v3(store.resolve("/1d.contiguous.f4.be"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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
		let arr = await open.v3(store.resolve("/1d.contiguous.f8"), {
			kind: "array",
		});
		expect(await arr.getChunk([0])).toMatchInlineSnapshot(`
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

	it("1d.contiguous.b1", async () => {
		let arr = await open.v3(store.resolve("/1d.contiguous.b1"), {
			kind: "array",
		});
		let chunk = await arr.getChunk([0]);
		expect(chunk).toMatchInlineSnapshot(`
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
		expect(Array.from(chunk.data as any)).toMatchInlineSnapshot(`
			[
			  true,
			  false,
			  true,
			  false,
			]
		`);
	});

	it("2d.contiguous.i2", async () => {
		let arr = await open.v3(store.resolve("/2d.contiguous.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0, 0])).toMatchInlineSnapshot(`
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
		let arr = await open.v3(store.resolve("/3d.contiguous.i2"), {
			kind: "array",
		});
		expect(await arr.getChunk([0, 0, 0])).toMatchInlineSnapshot(`
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
		let arr = await open.v3(store.resolve("/1d.chunked.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([arr.getChunk([0]), arr.getChunk([1])]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      1,
			      2,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      3,
			      4,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			]
		`);
	});

	it("1d.chunked.ragged.i2", async () => {
		let arr = await open.v3(store.resolve("/1d.chunked.ragged.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0]),
			arr.getChunk([1]),
			arr.getChunk([2]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      1,
			      2,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      3,
			      4,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      5,
			      0,
			    ],
			    "shape": [
			      2,
			    ],
			    "stride": [
			      1,
			    ],
			  },
			]
		`);
	});

	it("2d.chunked.i2", async () => {
		let arr = await open.v3(store.resolve("/2d.chunked.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0, 0]),
			arr.getChunk([0, 1]),
			arr.getChunk([1, 0]),
			arr.getChunk([1, 1]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      1,
			    ],
			    "shape": [
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      2,
			    ],
			    "shape": [
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      3,
			    ],
			    "shape": [
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      4,
			    ],
			    "shape": [
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			    ],
			  },
			]
		`);
	});

	it("2d.chunked.ragged.i2", async () => {
		let arr = await open.v3(store.resolve("/2d.chunked.ragged.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0, 0]),
			arr.getChunk([0, 1]),
			arr.getChunk([1, 0]),
			arr.getChunk([1, 1]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      1,
			      2,
			      4,
			      5,
			    ],
			    "shape": [
			      2,
			      2,
			    ],
			    "stride": [
			      2,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      3,
			      0,
			      6,
			      0,
			    ],
			    "shape": [
			      2,
			      2,
			    ],
			    "stride": [
			      2,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      7,
			      8,
			      0,
			      0,
			    ],
			    "shape": [
			      2,
			      2,
			    ],
			    "stride": [
			      2,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      9,
			      0,
			      0,
			      0,
			    ],
			    "shape": [
			      2,
			      2,
			    ],
			    "stride": [
			      2,
			      1,
			    ],
			  },
			]
		`);
	});

	it("3d.chunked.i2", async () => {
		let arr = await open.v3(store.resolve("/3d.chunked.i2"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0, 0, 2]),
			arr.getChunk([1, 1, 1]),
			arr.getChunk([2, 2, 2]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      2,
			    ],
			    "shape": [
			      1,
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      13,
			    ],
			    "shape": [
			      1,
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      26,
			    ],
			    "shape": [
			      1,
			      1,
			      1,
			    ],
			    "stride": [
			      1,
			      1,
			      1,
			    ],
			  },
			]
		`);
	});

	it("3d.chunked.mixed.i2.C", async () => {
		let arr = await open.v3(store.resolve("/3d.chunked.mixed.i2.C"), {
			kind: "array",
		});
		let chunks = await Promise.all([
			arr.getChunk([0, 0, 0]),
			arr.getChunk([0, 0, 1]),
			arr.getChunk([0, 0, 2]),
		]);
		expect(chunks).toMatchInlineSnapshot(`
			[
			  {
			    "data": Int16Array [
			      0,
			      3,
			      6,
			      9,
			      12,
			      15,
			      18,
			      21,
			      24,
			    ],
			    "shape": [
			      3,
			      3,
			      1,
			    ],
			    "stride": [
			      3,
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      1,
			      4,
			      7,
			      10,
			      13,
			      16,
			      19,
			      22,
			      25,
			    ],
			    "shape": [
			      3,
			      3,
			      1,
			    ],
			    "stride": [
			      3,
			      1,
			      1,
			    ],
			  },
			  {
			    "data": Int16Array [
			      2,
			      5,
			      8,
			      11,
			      14,
			      17,
			      20,
			      23,
			      26,
			    ],
			    "shape": [
			      3,
			      3,
			      1,
			    ],
			    "stride": [
			      3,
			      1,
			      1,
			    ],
			  },
			]
		`);
	});

	it("3d.chunked.mixed.i2.F", async () => {
		let arr = await open.v3(store.resolve("/3d.chunked.mixed.i2.F"), {
			kind: "array",
		});
		let [c1, c2, c3] = await Promise.all([
			arr.getChunk([0, 0, 0]),
			arr.getChunk([0, 0, 1]),
			arr.getChunk([0, 0, 2]),
		]);
		let shape = [3, 3, 1];
		let stride = [1, 3, 9];
		expect(c1.data).toStrictEqual(
			new Int16Array([0, 9, 18, 3, 12, 21, 6, 15, 24]),
		);
		expect(c1.shape).toStrictEqual(shape);
		expect(c1.stride).toStrictEqual(stride);
		expect(c2.data).toStrictEqual(
			new Int16Array([1, 10, 19, 4, 13, 22, 7, 16, 25]),
		);
		expect(c2.shape).toStrictEqual(shape);
		expect(c2.stride).toStrictEqual(stride);
		expect(c3.data).toStrictEqual(
			new Int16Array([2, 11, 20, 5, 14, 23, 8, 17, 26]),
		);
		expect(c3.shape).toStrictEqual(shape);
		expect(c3.stride).toStrictEqual(stride);
	});

	it("opens group from root", async () => {
		let grp = await open.v3(store, { kind: "group" });
		expect(grp.path).toBe("/");
	});

	it("throws when group not found", async () => {
		await expect(open.v3(store.resolve("/not/a/group"), { kind: "group" }))
			.rejects
			.toThrow(NodeNotFoundError);
	});

	it("opens array from group", async () => {
		let grp = await open.v3(store, { kind: "group" });
		let a1 = await open.v3(store.resolve("/1d.chunked.i2"), {
			kind: "array",
		});
		let a2 = await open.v3(grp.resolve("1d.chunked.i2"), {
			kind: "array",
		});
		expect(a1.path).toBe("/1d.chunked.i2");
		expect(a2.path).toBe("/1d.chunked.i2");
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
			data: Array.from(chunk.data as any),
		}).toStrictEqual({
			data: [true, false, true, false],
			shape: [4],
			stride: [1],
		});
	});

	describe("1d.chunked.compressed.sharded.i2", async () => {
		let arr = await open.v3(
			store.resolve("1d.chunked.compressed.sharded.i2"),
			{ kind: "array" },
		);
		it.each<[chunk_coord: [number], value: number]>([
			[[0], 1],
			[[1], 2],
			[[2], 3],
			[[3], 4],
		])(`getChunk(%j) -> Int16Array([%i])`, async (chunk_coord, expected) => {
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
		])(`getChunk(%j) -> Int16Array([%i])`, async (chunk_coord, expected) => {
			expect(await arr.getChunk(chunk_coord)).toStrictEqual({
				data: new Int16Array([expected]),
				shape: [1],
				stride: [1],
			});
		});
	});

	describe("2d.contiguous.compressed.sharded.i2", async () => {
		let arr = await open.v3(
			store.resolve("2d.chunked.compressed.sharded.i2"),
			{ kind: "array" },
		);
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
		])(
			"getChunk(%j) -> Int16Array([%i])",
			async (chunk_coords, expected) => {
				expect(await arr.getChunk(chunk_coords)).toStrictEqual({
					data: new Int16Array([expected]),
					shape: [1, 1],
					stride: [1, 1],
				});
			},
		);
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
		])(
			"getChunk(%j) -> Int32Array([%i])",
			async (chunk_coord, expected) => {
				expect(await arr.getChunk(chunk_coord)).toStrictEqual({
					data: new Int16Array([expected]),
					shape: [1, 1],
					stride: [1, 1],
				});
			},
		);
	});

	describe("2d.chunked.compressed.sharded.i2", async () => {
		let arr = await open.v3(
			store.resolve("2d.chunked.compressed.sharded.i2"),
			{ kind: "array" },
		);
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
		])(
			"getChunk(%j) -> Int32Array([%i])",
			async (chunk_coord, expected) => {
				expect(await arr.getChunk(chunk_coord)).toStrictEqual({
					data: new Int16Array([expected]),
					shape: [1, 1],
					stride: [1, 1],
				});
			},
		);
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
		let arr = await open.v3(
			store.resolve("3d.chunked.compressed.sharded.i2"),
			{ kind: "array" },
		);
		it.each<[chunk_coord: [number, number, number], value: number]>([
			[[0, 0, 0], 0],
			[[1, 0, 1], 17],
			[[2, 0, 0], 32],
			[[1, 1, 1], 21],
			[[1, 3, 2], 30],
			[[3, 3, 3], 63],
		])(
			"getChunk(%j) –> Int16Array([%i])",
			async (chunk_coords, expected) => {
				expect(await arr.getChunk(chunk_coords)).toStrictEqual({
					data: new Int16Array([expected]),
					shape: [1, 1, 1],
					stride: [1, 1, 1],
				});
			},
		);
	});

	describe("3d.chunked.mixed.compressed.sharded.i2", async () => {
		let arr = await open.v3(
			store.resolve("3d.chunked.mixed.compressed.sharded.i2"),
			{ kind: "array" },
		);
		it.each<[chunk_coord: [number, number, number], value: number[]]>([
			[[0, 0, 0], [0, 3, 6, 9, 12, 15, 18, 21, 24]],
			[[0, 0, 1], [1, 4, 7, 10, 13, 16, 19, 22, 25]],
			[[0, 0, 2], [2, 5, 8, 11, 14, 17, 20, 23, 26]],
		])(`getChunk(%j) -> Int16Array([%i])`, async (chunk_coord, expected) => {
			expect(await arr.getChunk(chunk_coord)).toStrictEqual({
				data: new Int16Array(expected),
				shape: [3, 3, 1],
				stride: [3, 1, 1],
			});
		});
	});
});
