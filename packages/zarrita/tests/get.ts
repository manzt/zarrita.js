import * as uvu from "uvu";
import * as assert from "uvu/assert";

import * as zarr from "../src/v2";

import * as ndarray_ops from "../src/ndarray";
import * as ops from "../src/ops";

import { range, slice } from "../src/lib/util";
import { IndexError } from "../src/lib/errors";
import ndarray from "ndarray";

interface Context {
	arr: zarr.Array<"<i4", Map<string, Uint8Array>>;
}

function register(name: string, getter: typeof ops.get | typeof ndarray_ops.get) {
	const suite = uvu.suite<Context>(name);
	const get = getter as typeof ops.get;

	suite.before(async (ctx) => {
		let arr = new zarr.Array({
			fill_value: null,
			order: "C",
			shape: [2, 3, 4],
			chunk_shape: [1, 2, 2],
			dtype: "<i4",
			store: new Map<string, Uint8Array>(),
			path: "/",
			chunk_separator: ".",
		});
		let shape = [2, 3, 4];
		let data = new Int32Array(range(2 * 3 * 4));
		await ndarray_ops.set(arr, null, ndarray(data, shape));
		ctx.arr = arr;
	});

	suite(
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
			assert.equal(data, new Int32Array([4, 5, 8, 9, 16, 17, 20, 21]));
			assert.equal(shape, [2, 2, 2]);
			assert.equal(stride, [4, 2, 1]);
		},
	);

	suite(
		`
selection = [null, null, 0]
array([[ 0,  4,  8],
       [12, 16, 20]])
`,
		async (ctx) => {
			let sel = [null, null, 0];
			let { data, shape, stride } = await get(ctx.arr, sel);
			assert.equal(data, new Int32Array([0, 4, 8, 12, 16, 20]));
			assert.equal(shape, [2, 3]);
			assert.equal(stride, [3, 1]);
		},
	);

	suite(
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
			assert.equal(data, new Int32Array([0, 1, 4, 5, 12, 13, 16, 17]));
			assert.equal(shape, [2, 2, 2]);
			assert.equal(stride, [4, 2, 1]);
		},
	);

	suite(`selection = [1, 1, 1], output = 17`, async (ctx) => {
		let sel = [1, 1, 1];
		let res = await get(ctx.arr, sel);
		assert.equal(res, 17);
	});

	suite(
		`
selection = [1, null, null]
array([[12, 13, 14, 15],
       [16, 17, 18, 19],
       [20, 21, 22, 23]])
`,
		async (ctx) => {
			let sel = [1, null, null];
			let { data, shape, stride } = await get(ctx.arr, sel);
			assert.equal(data, new Int32Array(range(12, 24)));
			assert.equal(shape, [3, 4]);
			assert.equal(stride, [4, 1]);
		},
	);

	suite(
		`
selection = [0, slice(null, null, 2), slice(null, null, 3)]
array([[ 0,  3],
       [ 8, 11]])
`,
		async (ctx) => {
			let sel = [0, slice(null, null, 2), slice(null, null, 3)];
			let { data, shape, stride } = await get(ctx.arr, sel);
			assert.equal(data, new Int32Array([0, 3, 8, 11]));
			assert.equal(shape, [2, 2]);
			assert.equal(stride, [2, 1]);
		},
	);

	suite(
		`
selection = [0, slice(null, null, 2), slice(null, null, 3)]
array([[ 0,  3],
       [ 8, 11]])
`,
		async (ctx) => {
			let sel = [0, slice(null, null, 2), slice(null, null, 3)];
			let { data, shape, stride } = await get(ctx.arr, sel);
			assert.equal(data, new Int32Array([0, 3, 8, 11]));
			assert.equal(shape, [2, 2]);
			assert.equal(stride, [2, 1]);
		},
	);

	suite(
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
			assert.equal(data, new Int32Array([0, 4, 8, 12, 16, 20]));
			assert.equal(shape, [2, 3, 1]);
			assert.equal(stride, [3, 1, 1]);
		},
	);

	suite(
		`
selection = [1, null, slice(null, 3, 2)]
array([[12, 14],
       [16, 18],
       [20, 22]])
`,
		async (ctx) => {
			let sel = [1, null, slice(null, 3, 2)];
			let { data, shape, stride } = await get(ctx.arr, sel);
			assert.equal(data, new Int32Array([12, 14, 16, 18, 20, 22]));
			assert.equal(shape, [3, 2]);
			assert.equal(stride, [2, 1]);
		},
	);

	suite(
		`
selection = [null, 1, null];
array([[ 4,  5,  6,  7],
       [16, 17, 18, 19]])
`,
		async (ctx) => {
			let sel = [null, 1, null];
			let { data, shape, stride } = await get(ctx.arr, sel);
			assert.equal(data, new Int32Array([4, 5, 6, 7, 16, 17, 18, 19]));
			assert.equal(shape, [2, 4]);
			assert.equal(stride, [4, 1]);
		},
	);

	suite(
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
			assert.equal(data, new Int32Array(range(24)));
			assert.equal(shape, [2, 3, 4]);
			assert.equal(stride, [12, 4, 1]);
		},
	);

	suite("Does not support negative indices", async (ctx) => {
		let sel = [0, slice(null, null, -2), slice(null, null, 3)];
		try {
			await get(ctx.arr, sel);
			assert.unreachable("should have thrown");
		} catch (err) {
			assert.ok("throws");
			assert.instance(err, IndexError);
		}
	});

	return suite;
}

register("builtin", ops.get).run();
register("ndarray", ndarray_ops.get).run();
