import { test } from "uvu";
import * as assert from "uvu/assert";

import type { DataType } from "../src/dtypes";

import { byteswap_inplace, get_ctr, get_strides, range, slice } from "../src/lib/util";

import { BoolArray, ByteStringArray, UnicodeStringArray } from "../src/lib/custom-arrays";

test("get_ctr", () => {
	// get an instance of returned constructor
	const get = <D extends DataType>(s: D) => new (get_ctr(s))(1);

	assert.instance(get("|i1"), Int8Array);
	assert.instance(get("<i2"), Int16Array);
	assert.instance(get(">i2"), Int16Array);
	assert.instance(get("<i4"), Int32Array);
	assert.instance(get(">i4"), Int32Array);
	assert.instance(get("<i8"), BigInt64Array);
	assert.instance(get(">i8"), BigInt64Array);

	assert.instance(get("|u1"), Uint8Array);
	assert.instance(get("<u2"), Uint16Array);
	assert.instance(get(">u2"), Uint16Array);
	assert.instance(get("<u4"), Uint32Array);
	assert.instance(get(">u4"), Uint32Array);
	assert.instance(get("<u8"), BigUint64Array);
	assert.instance(get(">u8"), BigUint64Array);

	assert.throws(() => get("<f2" as any));
	assert.throws(() => get(">f2" as any));
	assert.instance(get("<f4"), Float32Array);
	assert.instance(get(">f4"), Float32Array);
	assert.instance(get("<f8"), Float64Array);
	assert.instance(get(">f8"), Float64Array);

	assert.instance(get("|b1"), BoolArray);

	assert.instance(get("<U20"), UnicodeStringArray);
	assert.instance(get(">U20"), UnicodeStringArray);
	assert.is(get(">U20").chars, 20);
	assert.is(get("<U32").chars, 32);

	assert.instance(get("|S8"), ByteStringArray);
	assert.instance(get("|S4"), ByteStringArray);
	assert.is(get("|S16").chars, 16);
});

test("byteswap_inplace", () => {
	[
		[new Uint32Array([1, 2, 3, 4, 5]), new Uint32Array([1, 2, 3, 4, 5])],
		[
			new Float64Array([20, 3333, 444.4, 222, 3123]),
			new Float64Array([20, 3333, 444.4, 222, 3123]),
		],
		[new Float32Array([1, 2, 3, 42, 5]), new Float32Array([1, 2, 3, 42, 5])],
		[new Uint8Array([1, 2, 3, 4]), new Uint8Array([1, 2, 3, 4])],
		[new Int8Array([-3, 2, 3, 10]), new Int8Array([-3, 2, 3, 10])],
	].forEach(([arr, expected]) => {
		byteswap_inplace(arr);
		byteswap_inplace(arr);
		assert.equal(arr, expected);
	});
});

test("slice", () => {
	assert.is(slice(null).start, null);
	assert.is(slice(null).stop, null);
	assert.is(slice(null).step, null);
	assert.equal(slice(null).indices(10), [0, 10, 1]);

	assert.is(slice(3, 15, 2).start, 3);
	assert.is(slice(3, 15, 2).stop, 15);
	assert.is(slice(3, 15, 2).step, 2);
	assert.equal(slice(3, 15, 2).indices(10), [3, 10, 2]);
	assert.equal(slice(3, 15, 2).indices(30), [3, 15, 2]);

	assert.is(slice(40).start, null);
	assert.is(slice(40).stop, 40);
	assert.is(slice(40).step, null);
	assert.equal(slice(40).indices(4), [0, 4, 1]);
	assert.equal(slice(40).indices(41), [0, 40, 1]);

	assert.equal(slice(2, 10, -1).indices(20), [2, 10, -1]);
	assert.equal(slice(2, 10, -1).indices(4), [2, 3, -1]);

	assert.equal(slice(null, null, -3).indices(14), [13, -1, -3]);
	assert.equal(slice(null, null, -3).indices(14), [13, -1, -3]);
	assert.equal(slice(null, null, -3).indices(2), [1, -1, -3]);
});

test("range", () => {
	assert.equal([0, 1, 2, 3], Array.from(range(4)));
	assert.equal([0, 2, 4, 6, 8], Array.from(range(0, 10, 2)));
	assert.equal([0, 3, 6, 9], Array.from(range(0, 10, 3)));
	assert.equal([0], Array.from(range(0, 2, 3)));
	assert.equal([], Array.from(range(0)));
});

test("get_strides", () => {
	assert.equal(get_strides([3], "C"), [1]);
	assert.equal(get_strides([3], "F"), [1]);

	assert.equal(get_strides([3, 4], "C"), [4, 1]);
	assert.equal(get_strides([3, 4], "F"), [1, 3]);

	assert.equal(get_strides([3, 4, 10], "C"), [40, 10, 1]);
	assert.equal(get_strides([3, 4, 10], "F"), [1, 3, 12]);

	assert.equal(get_strides([3, 4, 10, 2], "C"), [80, 20, 2, 1]);
	assert.equal(get_strides([3, 4, 10, 2], "F"), [1, 3, 12, 120]);
});

test.run();
