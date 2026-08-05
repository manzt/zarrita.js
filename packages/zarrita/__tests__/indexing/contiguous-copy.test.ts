import { describe, expect, it } from "vitest";

import * as zarr from "../../src/index.js";

/**
 * Slicing the outermost dimension while taking the rest whole selects one
 * unbroken run of memory per chunk, which is copied with a single `set`.
 * These pin the cases where that shortcut must *not* be taken, since taking
 * it wrongly returns the wrong values rather than throwing.
 */

function cStride(shape: number[]) {
	return shape.map((_, i) => shape.slice(i + 1).reduce((a, b) => a * b, 1));
}

/** A C-ordered chunk holding `0..n`, offset by `base`. */
function chunk(shape: number[], base = 0) {
	const size = shape.reduce((a, b) => a * b, 1);
	const data = new Int32Array(size);
	for (let i = 0; i < size; i++) {
		data[i] = base + i;
	}
	return { data, shape, stride: cStride(shape) };
}

async function filled(shape: number[], chunkShape: number[], order?: number[]) {
	const codecs: zarr.CodecMetadata[] = [];
	if (order) {
		codecs.push({ name: "transpose", configuration: { order } });
	}
	codecs.push({ name: "bytes", configuration: { endian: "little" } });
	const arr = await zarr.create(zarr.root(new Map()).resolve("/a"), {
		shape,
		chunkShape,
		dtype: "int32",
		codecs,
	});
	await zarr.set(arr, null, chunk(shape));
	return arr;
}

describe("contiguous copy", () => {
	it("takes trailing dimensions whole, across a chunk boundary", async () => {
		// two rows either side of the boundary, every column of each
		const arr = await filled([4, 3, 2], [2, 3, 2]);
		const res = await zarr.get(arr, [zarr.slice(1, 3), null, null]);
		expect(res.shape).toStrictEqual([2, 3, 2]);
		expect(res.data).toStrictEqual(
			new Int32Array([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]),
		);
	});

	it("is not contiguous when an inner dimension is split across chunks", async () => {
		const arr = await filled([4, 4], [4, 2]);
		const res = await zarr.get(arr, [zarr.slice(1, 3), null]);
		expect(res.data).toStrictEqual(new Int32Array([4, 5, 6, 7, 8, 9, 10, 11]));
	});

	it("is not contiguous when an inner dimension is taken in part", async () => {
		const arr = await filled([4, 4], [4, 4]);
		const res = await zarr.get(arr, [zarr.slice(1, 3), zarr.slice(1, 3)]);
		expect(res.data).toStrictEqual(new Int32Array([5, 6, 9, 10]));
	});

	it("is not contiguous when the step is not 1", async () => {
		const arr = await filled([8], [8]);
		const res = await zarr.get(arr, [zarr.slice(0, 8, 2)]);
		expect(res.data).toStrictEqual(new Int32Array([0, 2, 4, 6]));
	});

	it("is not contiguous when the step is not 1 in an inner dimension", async () => {
		const arr = await filled([2, 4], [2, 4]);
		const res = await zarr.get(arr, [null, zarr.slice(0, 4, 2)]);
		expect(res.data).toStrictEqual(new Int32Array([0, 2, 4, 6]));
	});

	it("is not contiguous when an integer index drops the outer dimension", async () => {
		const arr = await filled([4, 3], [2, 3]);
		const res = await zarr.get(arr, [1, null]);
		expect(res.shape).toStrictEqual([3]);
		expect(res.data).toStrictEqual(new Int32Array([3, 4, 5]));
	});

	it("is not contiguous when an integer index drops an inner dimension", async () => {
		const arr = await filled([4, 3], [2, 3]);
		const res = await zarr.get(arr, [null, 1]);
		expect(res.shape).toStrictEqual([4]);
		expect(res.data).toStrictEqual(new Int32Array([1, 4, 7, 10]));
	});

	it("is not contiguous when a dropped dimension leaves a unit-length trail", async () => {
		// the trailing run is one element, so the strides alone cannot tell the
		// dropped dimension apart from a whole one
		const arr = await filled([4, 1], [4, 1]);
		const res = await zarr.get(arr, [1, null]);
		expect(res.shape).toStrictEqual([1]);
		expect(res.data).toStrictEqual(new Int32Array([1]));
	});

	it("takes the array's own order into account, not the selection's shape", async () => {
		// laid out with the first axis fastest, so a row is *not* a run of
		// memory even though the trailing dimension is taken whole
		const arr = await filled([4, 3], [4, 3], [1, 0]);
		const res = await zarr.get(arr, [zarr.slice(1, 3), null]);
		expect(res.stride).toStrictEqual([1, 2]);
		// stride [1, 2] means row 1 is at [0], [2], [4]
		expect(res.data).toStrictEqual(new Int32Array([3, 6, 4, 7, 5, 8]));
	});
});

/**
 * The same code copies in both directions. A write swaps the two sides of each
 * projection. The shortcut also occurs on a write, with the chunk as the
 * destination. Read tests alone do not find an error in that direction.
 */
describe("contiguous copy, writing", () => {
	it("takes trailing dimensions whole, across a chunk boundary", async () => {
		const arr = await filled([4, 3, 2], [2, 3, 2]);
		await zarr.set(arr, [zarr.slice(1, 3), null, null], chunk([2, 3, 2], 100));
		const res = await zarr.get(arr, null);
		expect(res.data).toStrictEqual(
			new Int32Array([
				0, 1, 2, 3, 4, 5, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
				111, 18, 19, 20, 21, 22, 23,
			]),
		);
	});

	it("is not contiguous when an inner dimension is taken in part", async () => {
		const arr = await filled([4, 4], [4, 4]);
		await zarr.set(
			arr,
			[zarr.slice(1, 3), zarr.slice(1, 3)],
			chunk([2, 2], 100),
		);
		const res = await zarr.get(arr, null);
		expect(res.data).toStrictEqual(
			new Int32Array([
				0, 1, 2, 3, 4, 100, 101, 7, 8, 102, 103, 11, 12, 13, 14, 15,
			]),
		);
	});

	it("is not contiguous when an inner dimension is split across chunks", async () => {
		const arr = await filled([4, 4], [4, 2]);
		await zarr.set(arr, [zarr.slice(1, 3), null], chunk([2, 4], 100));
		const res = await zarr.get(arr, null);
		expect(res.data).toStrictEqual(
			new Int32Array([
				0, 1, 2, 3, 100, 101, 102, 103, 104, 105, 106, 107, 12, 13, 14, 15,
			]),
		);
	});

	it("is not contiguous when the step is not 1", async () => {
		const arr = await filled([8], [8]);
		await zarr.set(arr, [zarr.slice(0, 8, 2)], chunk([4], 100));
		const res = await zarr.get(arr, null);
		expect(res.data).toStrictEqual(
			new Int32Array([100, 1, 101, 3, 102, 5, 103, 7]),
		);
	});

	it("is not contiguous when an integer index drops the outer dimension", async () => {
		const arr = await filled([4, 3], [2, 3]);
		await zarr.set(arr, [1, null], chunk([3], 100));
		const res = await zarr.get(arr, null);
		expect(res.data).toStrictEqual(
			new Int32Array([0, 1, 2, 100, 101, 102, 6, 7, 8, 9, 10, 11]),
		);
	});
});
