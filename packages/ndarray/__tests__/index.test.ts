import { describe, expect, it } from "vitest";
import * as path from "node:path";
import * as url from "node:url";

import { get } from "../index.js";
import { range } from "../../core/src/lib/util.js";

import type * as zarr from "@zarrita/core/types";
import { BoolArray, ByteStringArray, UnicodeStringArray } from "@zarrita/typedarray";
import { FSStore } from "@zarrita/storage";
import { get_array } from "@zarrita/core/v2";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

let root = path.resolve(__dirname, "../../core/__tests__/data/data.zarr");
let store = new FSStore(root);


describe("ndarray", () => {

	it("reads 1d.contiguous.zlib.i2", async () => {
		let arr = await get_array(store, "/1d.contiguous.zlib.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.blosc.i2", async () => {
		let arr = await get_array(store, "/1d.contiguous.blosc.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.lz4.i2", async () => {
		let arr = await get_array(store, "/1d.contiguous.lz4.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.zstd.i2", async () => {
		let arr = await get_array(store, "/1d.contiguous.zstd.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.raw.i2", async () => {
		let arr = await get_array(store, "/1d.contiguous.raw.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.i4", async () => {
		let arr = await get_array(store, "/1d.contiguous.i4") as zarr.Array<"<i4">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int32Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.u1", async () => {
		let arr = await get_array(store, "/1d.contiguous.u1") as zarr.Array<"|u1">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Uint8Array([255, 0, 255, 0]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.f4.le", async () => {
		let arr = await get_array(store, "/1d.contiguous.f4.le") as zarr.Array<"<f4">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Float32Array([-1000.5, 0, 1000.5, 0]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.f4.be", async () => {
		let arr = await get_array(store, "/1d.contiguous.f4.be") as zarr.Array<">f4">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Float32Array([-1000.5, 0, 1000.5, 0]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.f8", async () => {
		let arr = await get_array(store, "/1d.contiguous.f8") as zarr.Array<"<f8">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Float64Array([1.5, 2.5, 3.5, 4.5]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.U13.le", async () => {
		let arr = await get_array(store, "/1d.contiguous.U13.le") as unknown as zarr.Array<
			"<U13"
		>;
		let res = await get(arr as any);
		expect(res.data).toBeInstanceOf(UnicodeStringArray);
		expect(Array.from(res.data as any)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.U13.be", async () => {
		let arr = await get_array(store, "/1d.contiguous.U13.be") as unknown as zarr.Array<
			">U13"
		>;
		let res = await get(arr);
		expect(res.data).toBeInstanceOf(UnicodeStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.U7", async () => {
		let arr = await get_array(store, "/1d.contiguous.U7") as unknown as zarr.Array<"<U7">;
		let res = await get(arr);
		expect(res.data).toBeInstanceOf(UnicodeStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.S7", async () => {
		let arr = await get_array(store, "/1d.contiguous.S7") as unknown as zarr.Array<"|S7">;
		let res = await get(arr);
		expect(res.data).toBeInstanceOf(ByteStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.b1", async () => {
		let arr = await get_array(store, "/1d.contiguous.b1") as zarr.Array<"|b1">;
		let res = await get(arr);
		expect(res.data).toBeInstanceOf(BoolArray);
		expect(Array.from(res.data)).toStrictEqual([true, false, true, false]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 2d.contiguous.i2", async () => {
		let arr = await get_array(store, "/2d.contiguous.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([2, 2]);
	});

	it("reads 3d.contiguous.i2", async () => {
		let arr = await get_array(store, "/3d.contiguous.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
	});

	it("reads 1d.chunked.i2", async () => {
		let arr = await get_array(store, "/1d.chunked.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("reads 1d.chunked.ragged.i2", async () => {
		let arr = await get_array(store, "/1d.chunked.ragged.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4, 5]));
		expect(res.shape).toStrictEqual([5]);
	});

	it("reads 2d.chunked.i2", async () => {
		let arr = await get_array(store, "/2d.chunked.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([2, 2]);
	});

	it("reads 2d.chunked.U7", async () => {
		let arr = await get_array(store, "/2d.chunked.U7") as unknown as zarr.Array<"<U7">;
		let res = await get(arr as any);
		expect(Array.from(res.data as any)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([2, 2]);
	});

	it("reads 2d.chunked.ragged.i2", async () => {
		let arr = await get_array(store, "/2d.chunked.ragged.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array(range(1, 10)));
		expect(res.shape).toStrictEqual([3, 3]);
	});

	it("reads 3d.chunked.i2", async () => {
		let arr = await get_array(store, "/3d.chunked.i2") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
	});

	it("reads 3d.chunked.mixed.i2.C", async () => {
		let arr = await get_array(store, "/3d.chunked.mixed.i2.C") as zarr.Array<"<i2">;
		let res = await get(arr);
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
		expect(res.stride).toStrictEqual([9, 3, 1]);
	});

	it("reads 3d.chunked.mixed.i2.F", async () => {
		let arr = await get_array(store, "/3d.chunked.mixed.i2.F") as zarr.Array<"<i2">;
		let res = await get(arr);
		// deno-fmt-ignore
		expect(res.data).toStrictEqual(new Int16Array([
			0,  9, 18,  3, 12, 21,  6, 15, 24,
			1, 10, 19,  4, 13, 22,  7, 16, 25,
			2, 11, 20,  5, 14, 23,  8, 17, 26, 
		]));
		expect(res.shape).toStrictEqual([3, 3, 3]);
		expect(res.stride).toStrictEqual([1, 3, 9]);
	});

	it("reads 3d.chunked.mixed.i2.F -- force C", async () => {
		let arr = await get_array(store, "/3d.chunked.mixed.i2.F") as zarr.Array<"<i2">;
		let res = await get(arr, null, { order: "C" });
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
		expect(res.stride).toStrictEqual([9, 3, 1]);
	});
});

