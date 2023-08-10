import * as url from "node:url";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import FSStore from "@zarrita/storage/fs";
import { BoolArray } from "@zarrita/typedarray";

import * as zarr from "../src/index.js";
import { range } from "../src/util.js";
import { NodeNotFoundError } from "../src/errors.js";
import { get } from "../src/ops.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

let root = path.resolve(__dirname, "../../../fixtures/v3/data.zarr");
let store = zarr.root(new FSStore(root));

describe("contiguous", () => {
	it("reads 1d.contiguous.gzip.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.contiguous.gzip.i2"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0]);
		expect(chunk.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.blosc.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.contiguous.blosc.i2"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0]);
		expect(chunk.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.raw.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.contiguous.raw.i2"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0]);
		expect(chunk.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.i4", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.contiguous.i4"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0]);
		expect(chunk.data).toStrictEqual(new Int32Array([1, 2, 3, 4]));
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.u1", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.contiguous.u1"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0]);
		expect(chunk.data).toStrictEqual(new Uint8Array([255, 0, 255, 0]));
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.f4.le", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.contiguous.f4.le"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0]);
		expect(chunk.data).toStrictEqual(new Float32Array([-1000.5, 0, 1000.5, 0]));
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.f4.be", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.contiguous.f4.be"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0]);
		expect(chunk.data).toStrictEqual(new Float32Array([-1000.5, 0, 1000.5, 0]));
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.f8", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.contiguous.f8"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0]);
		expect(chunk.data).toStrictEqual(new Float64Array([1.5, 2.5, 3.5, 4.5]));
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("reads 1d.contiguous.b1", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.contiguous.b1"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0]);
		expect(chunk.data).toBeInstanceOf(BoolArray);
		expect(Array.from(chunk.data as BoolArray)).toStrictEqual([
			true,
			false,
			true,
			false,
		]);
		expect(chunk.shape).toStrictEqual([4]);
	});

	it("reads 2d.contiguous.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/2d.contiguous.i2"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0, 0]);
		expect(chunk.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(chunk.shape).toStrictEqual([2, 2]);
	});

	it("reads 3d.contiguous.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/3d.contiguous.i2"), {
			kind: "array",
		});
		let chunk = await arr.get_chunk([0, 0, 0]);
		expect(chunk.data).toStrictEqual(new Int16Array(range(27)));
		expect(chunk.shape).toStrictEqual([3, 3, 3]);
	});
});

describe("chunked", () => {
	it("reads 1d.chunked.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.chunked.i2"), {
			kind: "array",
		});
		let [c1, c2] = await Promise.all([
			arr.get_chunk([0]),
			arr.get_chunk([1]),
		]);
		expect(c1.data).toStrictEqual(new Int16Array([1, 2]));
		expect(c1.shape).toStrictEqual([2]);
		expect(c2.data).toStrictEqual(new Int16Array([3, 4]));
		expect(c2.shape).toStrictEqual([2]);
	});

	it("reads 1d.chunked.ragged.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/1d.chunked.ragged.i2"), {
			kind: "array",
		});
		let [c1, c2, c3] = await Promise.all([
			arr.get_chunk([0]),
			arr.get_chunk([1]),
			arr.get_chunk([2]),
		]);
		expect(c1.data).toStrictEqual(new Int16Array([1, 2]));
		expect(c1.shape).toStrictEqual([2]);
		expect(c2.data).toStrictEqual(new Int16Array([3, 4]));
		expect(c2.shape).toStrictEqual([2]);
		expect(c3.data).toStrictEqual(new Int16Array([5, 0]));
		expect(c3.shape).toStrictEqual([2]);
	});

	it("reads 2d.chunked.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/2d.chunked.i2"), {
			kind: "array",
		});
		let [c1, c2, c3, c4] = await Promise.all([
			arr.get_chunk([0, 0]),
			arr.get_chunk([0, 1]),
			arr.get_chunk([1, 0]),
			arr.get_chunk([1, 1]),
		]);
		expect(c1.data).toStrictEqual(new Int16Array([1]));
		expect(c1.shape).toStrictEqual([1, 1]);
		expect(c2.data).toStrictEqual(new Int16Array([2]));
		expect(c2.shape).toStrictEqual([1, 1]);
		expect(c3.data).toStrictEqual(new Int16Array([3]));
		expect(c3.shape).toStrictEqual([1, 1]);
		expect(c4.data).toStrictEqual(new Int16Array([4]));
		expect(c4.shape).toStrictEqual([1, 1]);
	});

	it("reads 2d.chunked.ragged.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/2d.chunked.ragged.i2"), {
			kind: "array",
		});
		let [c1, c2, c3, c4] = await Promise.all([
			arr.get_chunk([0, 0]),
			arr.get_chunk([0, 1]),
			arr.get_chunk([1, 0]),
			arr.get_chunk([1, 1]),
		]);
		expect(c1.data).toStrictEqual(new Int16Array([1, 2, 4, 5]));
		expect(c1.shape).toStrictEqual([2, 2]);
		expect(c2.data).toStrictEqual(new Int16Array([3, 0, 6, 0]));
		expect(c2.shape).toStrictEqual([2, 2]);
		expect(c3.data).toStrictEqual(new Int16Array([7, 8, 0, 0]));
		expect(c3.shape).toStrictEqual([2, 2]);
		expect(c4.data).toStrictEqual(new Int16Array([9, 0, 0, 0]));
		expect(c4.shape).toStrictEqual([2, 2]);
	});

	it("reads 3d.chunked.i2", async () => {
		let arr = await zarr.open.v3(store.resolve("/3d.chunked.i2"), {
			kind: "array",
		});
		let [c2, c3, c4] = await Promise.all([
			arr.get_chunk([0, 0, 2]),
			arr.get_chunk([1, 1, 1]),
			arr.get_chunk([2, 2, 2]),
		]);
		expect(c2.data).toStrictEqual(new Int16Array([2]));
		expect(c2.shape).toStrictEqual([1, 1, 1]);
		expect(c3.data).toStrictEqual(new Int16Array([13]));
		expect(c3.shape).toStrictEqual([1, 1, 1]);
		expect(c4.data).toStrictEqual(new Int16Array([26]));
		expect(c4.shape).toStrictEqual([1, 1, 1]);
	});
});

describe("mixed", () => {
	it("reads 3d.chunked.mixed.i2.C", async () => {
		let arr = await zarr.open.v3(store.resolve("/3d.chunked.mixed.i2.C"), {
			kind: "array",
		});
		let [c1, c2, c3] = await Promise.all([
			arr.get_chunk([0, 0, 0]),
			arr.get_chunk([0, 0, 1]),
			arr.get_chunk([0, 0, 2]),
		]);
		let shape = [3, 3, 1];
		let stride = [3, 1, 1];
		expect(c1.data).toStrictEqual(new Int16Array(range(0, 27, 3)));
		expect(c1.shape).toStrictEqual(shape);
		expect(c1.stride).toStrictEqual(stride);
		expect(c2.data).toStrictEqual(new Int16Array(range(1, 27, 3)));
		expect(c2.shape).toStrictEqual(shape);
		expect(c2.stride).toStrictEqual(stride);
		expect(c3.data).toStrictEqual(new Int16Array(range(2, 27, 3)));
		expect(c3.shape).toStrictEqual(shape);
		expect(c3.stride).toStrictEqual(stride);
	});

	it.skip("reads 3d.chunked.mixed.i2.F", async () => {
		let arr = await zarr.open.v3(store.resolve("/3d.chunked.mixed.i2.F"), {
			kind: "array",
		});
		let [c1, c2, c3] = await Promise.all([
			arr.get_chunk([0, 0, 0]),
			arr.get_chunk([0, 0, 1]),
			arr.get_chunk([0, 0, 2]),
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
});

describe("traverse", () => {
	it("opens group", async () => {
		let grp = await zarr.open.v3(store, { kind: "group" });
		expect(grp.path).toBe("/");
		await expect(zarr.open.v3(store.resolve("/not/a/group"), { kind: "group" }))
			.rejects
			.toThrow(NodeNotFoundError);
	});

	it("opens array from group", async () => {
		let grp = await zarr.open.v3(store, { kind: "group" });
		let a1 = await zarr.open.v3(store.resolve("/1d.chunked.i2"), { kind: "array" });
		let a2 = await zarr.open.v3(grp.resolve("1d.chunked.i2"), { kind: "array" });
		expect(a1.path).toBe("/1d.chunked.i2");
		expect(a2.path).toBe("/1d.chunked.i2");
	});
});
