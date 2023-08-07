import { beforeEach, describe, it, expect } from "vitest";
import ndarray from "ndarray";

import * as ops from "../src/ops.js";

import { range, slice } from "../src/util.js";
import { IndexError } from "../src/errors.js";
import * as zarr from "../src/hierarchy.js";

interface Context {
	arr: zarr.Array<"int32", Map<string, Uint8Array>>;
}

export function run_suite(name: string, getter: any) {
	const get = getter as typeof ops.get;

	beforeEach<Context>(async (ctx) => {
		let arr = new zarr.Array(
			new Map<string, Uint8Array>(),
			"/",
			{
				zarr_format: 3,
				node_type: "array",
				shape: [2, 3, 4],
				data_type: "int32",
				chunk_grid: {
					name: "regular",
					configuration: {
						chunk_shape: [1, 2, 2],
					}
				},
				chunk_key_encoding: {
					name: "default",
					configuration: {
						separator: ".",
					}
				},
				codecs: [],
				fill_value: null,
				attributes: {}
			}
		);
		let shape = [2, 3, 4];
		let data = new Int32Array(range(2 * 3 * 4));
		await ops.set(arr, null, ndarray(data, shape));
		ctx.arr = arr;
	});

	describe(name, () => {
		it<Context>(
			`
selection = [null, slice(1, 3), slice(2)]
array([[[ 4,  5],
        [ 8,  9]],

       [[16, 17],
        [20, 21]]])
`,
			async (ctx) => {
				let sel = [null, slice(1, 3), slice(2)];
				let { data, shape, stride } = await get(ctx.arr, sel);
				expect(data).toStrictEqual(new Int32Array([4, 5, 8, 9, 16, 17, 20, 21]));
				expect(shape).toStrictEqual([2, 2, 2]);
				expect(stride).toStrictEqual([4, 2, 1]);
			},
		);

		it<Context>(
			`
selection = [null, null, 0]
array([[ 0,  4,  8],
       [12, 16, 20]])
`,
			async (ctx) => {
				let sel = [null, null, 0];
				let { data, shape, stride } = await get(ctx.arr, sel);
				expect(data).toStrictEqual(new Int32Array([0, 4, 8, 12, 16, 20]));
				expect(shape).toStrictEqual([2, 3]);
				expect(stride).toStrictEqual([3, 1]);
			},
		);

		it<Context>(
			`
selection = [slice(3), slice(2), slice(2)]
array([[[ 0,  1],
        [ 4,  5]],

       [[12, 13],
        [16, 17]]])
`,
			async (ctx) => {
				let sel = [slice(3), slice(2), slice(2)];
				let { data, shape, stride } = await get(ctx.arr, sel);
				expect(data).toStrictEqual(new Int32Array([0, 1, 4, 5, 12, 13, 16, 17]));
				expect(shape).toStrictEqual([2, 2, 2]);
				expect(stride).toStrictEqual([4, 2, 1]);
			},
		);

		it<Context>(`selection = [1, 1, 1], output = 17`, async (ctx) => {
			let sel = [1, 1, 1];
			let res = await get(ctx.arr, sel);
			expect(res).toBe(17);
		});

		it<Context>(
			`
selection = [1, null, null]
array([[12, 13, 14, 15],
       [16, 17, 18, 19],
       [20, 21, 22, 23]])
`,
			async (ctx) => {
				let sel = [1, null, null];
				let { data, shape, stride } = await get(ctx.arr, sel);
				expect(data).toStrictEqual(new Int32Array(range(12, 24)));
				expect(shape).toStrictEqual([3, 4]);
				expect(stride).toStrictEqual([4, 1]);
			},
		);

		it<Context>(
			`
selection = [0, slice(null, null, 2), slice(null, null, 3)]
array([[ 0,  3],
       [ 8, 11]])
`,
			async (ctx) => {
				let sel = [0, slice(null, null, 2), slice(null, null, 3)];
				let { data, shape, stride } = await get(ctx.arr, sel);
				expect(data).toStrictEqual(new Int32Array([0, 3, 8, 11]));
				expect(shape).toStrictEqual([2, 2]);
				expect(stride).toStrictEqual([2, 1]);
			},
		);

		it<Context>(
			`
selection = [0, slice(null, null, 2), slice(null, null, 3)]
array([[ 0,  3],
       [ 8, 11]])
`,
			async (ctx) => {
				let sel = [0, slice(null, null, 2), slice(null, null, 3)];
				let { data, shape, stride } = await get(ctx.arr, sel);
				expect(data).toStrictEqual(new Int32Array([0, 3, 8, 11]));
				expect(shape).toStrictEqual([2, 2]);
				expect(stride).toStrictEqual([2, 1]);
			},
		);

		it<Context>(
			`
selection = [null, null, slice(null, null, 4)]
array([[[ 0],
        [ 4],
        [ 8]],

       [[12],
        [16],
        [20]]])
`,
			async (ctx) => {
				let sel = [null, null, slice(null, null, 4)];
				let { data, shape, stride } = await get(ctx.arr, sel);
				expect(data).toStrictEqual(new Int32Array([0, 4, 8, 12, 16, 20]));
				expect(shape).toStrictEqual([2, 3, 1]);
				expect(stride).toStrictEqual([3, 1, 1]);
			},
		);

		it<Context>(
			`
selection = [1, null, slice(null, 3, 2)]
array([[12, 14],
       [16, 18],
       [20, 22]])
`,
			async (ctx) => {
				let sel = [1, null, slice(null, 3, 2)];
				let { data, shape, stride } = await get(ctx.arr, sel);
				expect(data).toStrictEqual(new Int32Array([12, 14, 16, 18, 20, 22]));
				expect(shape).toStrictEqual([3, 2]);
				expect(stride).toStrictEqual([2, 1]);
			},
		);

		it<Context>(
			`
selection = [null, 1, null];
array([[ 4,  5,  6,  7],
       [16, 17, 18, 19]])
`,
			async (ctx) => {
				let sel = [null, 1, null];
				let { data, shape, stride } = await get(ctx.arr, sel);
				expect(data).toStrictEqual(new Int32Array([4, 5, 6, 7, 16, 17, 18, 19]));
				expect(shape).toStrictEqual([2, 4]);
				expect(stride).toStrictEqual([4, 1]);
			},
		);

		it<Context>(
			`
selection = null;
array([[[ 0,  1,  2,  3],
        [ 4,  5,  6,  7],
        [ 8,  9, 10, 11]],

       [[12, 13, 14, 15],
        [16, 17, 18, 19],
        [20, 21, 22, 23]]])
`,
			async (ctx) => {
				let { data, shape, stride } = await get(ctx.arr);
				expect(data).toStrictEqual(new Int32Array(range(24)));
				expect(shape).toStrictEqual([2, 3, 4]);
				expect(stride).toStrictEqual([12, 4, 1]);
			},
		);

		it<Context>("reads Does not support negative indices", async (ctx) => {
			let sel = [0, slice(null, null, -2), slice(null, null, 3)];
			await expect(get(ctx.arr, sel))
				.rejects
				.toThrowError(IndexError);
		});
	});
}

run_suite("builtins", ops.get);
