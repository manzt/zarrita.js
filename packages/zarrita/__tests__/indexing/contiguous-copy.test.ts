import { describe, expect, it } from "vitest";

import * as zarr from "../../src/index.js";

/**
 * Slicing the outermost dimension while taking the rest whole selects one
 * unbroken run of memory per chunk, which is copied with a single `set`.
 * These pin the cases where that shortcut must *not* be taken, since taking
 * it wrongly returns the wrong values rather than throwing.
 */

async function filled(shape: number[], chunkShape: number[], order?: number[]) {
	const store = new Map<string, Uint8Array>();
	const codecs: Record<string, unknown>[] = [];
	if (order) {
		codecs.push({ name: "transpose", configuration: { order } });
	}
	codecs.push({ name: "bytes", configuration: { endian: "little" } });
	const arr = await zarr.create(store as never, {
		shape,
		chunkShape,
		dtype: "int32",
		// biome-ignore lint/suspicious/noExplicitAny: inline codec metadata
		codecs: codecs as any,
	});
	const size = shape.reduce((a, b) => a * b, 1);
	const data = new Int32Array(size);
	for (let i = 0; i < size; i++) {
		data[i] = i;
	}
	const stride = shape.map((_, i) =>
		shape.slice(i + 1).reduce((a, b) => a * b, 1),
	);
	await zarr.set(arr, null, { data, shape, stride });
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
