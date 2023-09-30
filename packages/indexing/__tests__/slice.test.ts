import { describe, expect, it } from "vitest";
import ndarray from "ndarray";
import * as zarr from "@zarrita/core";

import * as ops from "../src/ops.js";
import { range, slice } from "../src/util.js";
import { IndexError } from "../src/indexer.js";

export function run_suite(name: string, getter: any) {
	const get = getter as typeof ops.get;

	describe(name, async () => {
		let arr = await zarr.create(new Map(), {
			shape: [2, 3, 4],
			data_type: "int32",
			chunk_shape: [1, 2, 2],
		});
		await ops.set(
			arr,
			null,
			ndarray(new Int32Array(range(2 * 3 * 4)), arr.shape),
		);

		it.each([
			[
				[null, slice(1, 3), slice(2)],
				{
					data: new Int32Array([4, 5, 8, 9, 16, 17, 20, 21]),
					shape: [2, 2, 2],
					stride: [4, 2, 1],
				},
			],
			[
				[null, null, 0],
				{
					data: new Int32Array([0, 4, 8, 12, 16, 20]),
					shape: [2, 3],
					stride: [3, 1],
				},
			],
			[
				[slice(3), slice(2), slice(2)],
				{
					data: new Int32Array([0, 1, 4, 5, 12, 13, 16, 17]),
					shape: [2, 2, 2],
					stride: [4, 2, 1],
				},
			],
			[
				[1, null, null],
				{
					data: new Int32Array(range(12, 24)),
					shape: [3, 4],
					stride: [4, 1],
				},
			],
			[
				[0, slice(null, null, 2), slice(null, null, 3)],
				{
					data: new Int32Array([0, 3, 8, 11]),
					shape: [2, 2],
					stride: [2, 1],
				},
			],
			[
				[null, null, slice(null, null, 4)],
				{
					data: new Int32Array([0, 4, 8, 12, 16, 20]),
					shape: [2, 3, 1],
					stride: [3, 1, 1],
				},
			],
			[
				[1, null, slice(null, 3, 2)],
				{
					data: new Int32Array([12, 14, 16, 18, 20, 22]),
					shape: [3, 2],
					stride: [2, 1],
				},
			],
			[
				[null, 1, null],
				{
					data: new Int32Array([4, 5, 6, 7, 16, 17, 18, 19]),
					shape: [2, 4],
					stride: [4, 1],
				},
			],
			[
				undefined,
				{
					data: new Int32Array(range(24)),
					shape: [2, 3, 4],
					stride: [12, 4, 1],
				},
			],
		])(`Reads selection - %j`, async (sel, expected) => {
			let { data, shape, stride } = await get(arr, sel);
			expect({ data, shape, stride }).toStrictEqual(expected);
		});

		it("Reads a scalar", async () => {
			let sel = [1, 1, 1];
			let val = await get(arr, sel);
			expect(val).toBe(17);
		});

		it("Does not support negative indices", async () => {
			let sel = [0, slice(null, null, -2), slice(null, null, 3)];
			await expect(get(arr, sel))
				.rejects
				.toThrowError(IndexError);
		});
	});
}

run_suite("builtins", ops.get);
