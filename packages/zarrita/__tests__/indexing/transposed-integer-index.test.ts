import { describe, expect, it } from "vitest";

import * as zarr from "../../src/index.js";

/**
 * An integer index drops a dimension, and the copy for that dimension is a
 * single element, so it terminates the walk through `setFromChunkBinary`.
 * Those two terminal cases addressed the element by its index alone, which is
 * its offset only when the axis has stride 1 — true of the last axis of a
 * C-contiguous chunk, and not true of an array with a transpose `order`.
 */

const SHAPE = [3, 4, 5];
const STRIDE = [20, 5, 1];

async function transposed() {
	const store = new Map<string, Uint8Array>();
	const arr = await zarr.create(zarr.root(store).resolve("/a"), {
		shape: SHAPE,
		chunkShape: SHAPE,
		dtype: "int32",
		codecs: [
			{ name: "transpose", configuration: { order: [2, 1, 0] } },
			{ name: "bytes", configuration: { endian: "little" } },
		],
	});
	// element (i,j,k) = 20*i + 5*j + k
	const data = new Int32Array(60).map((_, i) => i);
	await zarr.set(arr, null, { data, shape: SHAPE, stride: STRIDE });
	return arr;
}

/** Read a chunk's values in logical (C) order, honoring its strides. */
function toLogical<D extends zarr.DataType>(chunk: zarr.Chunk<D>): unknown[] {
	const { data, shape, stride } = chunk;
	const total = shape.reduce((a, b) => a * b, 1);
	const index = new globalThis.Array(shape.length).fill(0);
	const out: unknown[] = [];
	for (let n = 0; n < total; n++) {
		out.push(
			(data as ArrayLike<unknown>)[
				index.reduce((acc, v, d) => acc + v * stride[d], 0)
			],
		);
		for (let d = shape.length - 1; d >= 0; d--) {
			if (++index[d] < shape[d]) break;
			index[d] = 0;
		}
	}
	return out;
}

describe("integer index into a transposed array", () => {
	it("reads the indexed element, not the one at that offset", async () => {
		const arr = await transposed();
		// the last axis has stride 12 here, so index 3 is offset 36, not 3
		expect(toLogical(await zarr.get(arr, [null, null, 3]))).toEqual([
			3, 8, 13, 18, 23, 28, 33, 38, 43, 48, 53, 58,
		]);
		expect(toLogical(await zarr.get(arr, [1, null, 3]))).toEqual([
			23, 28, 33, 38,
		]);
		expect(toLogical(await zarr.get(arr, [null, 2, 3]))).toEqual([13, 33, 53]);
		expect(await zarr.get(arr, [1, 2, 3])).toBe(33);
	});

	it("writes to the indexed element", async () => {
		const arr = await transposed();
		// a chunk rather than a scalar, so this goes through the copy under test
		await zarr.set(arr, [null, null, 3], {
			data: new Int32Array(12).fill(-1),
			shape: [3, 4],
			stride: [4, 1],
		});
		const whole = toLogical(await zarr.get(arr, null)) as number[];
		const changed = whole
			.map((v, i) => (v === -1 ? i : -1))
			.filter((i) => i >= 0);
		// exactly the elements whose last index is 3
		expect(changed).toEqual([3, 8, 13, 18, 23, 28, 33, 38, 43, 48, 53, 58]);
	});
});
