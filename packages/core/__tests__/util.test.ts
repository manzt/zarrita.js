import { test, expect } from "vitest";

import type { DataType } from "../src/dtypes.js";

import { byteswap_inplace, get_ctr, get_strides, range, slice } from "../src/lib/util.js";

import { BoolArray, ByteStringArray, UnicodeStringArray } from "@zarrita/typedarray";

test("get_ctr", () => {
	// get an instance of returned constructor
	const get = <D extends DataType>(s: D) => new (get_ctr(s))(1);

	expect(get("|i1")).toBeInstanceOf(Int8Array);
	expect(get("<i2")).toBeInstanceOf(Int16Array);
	expect(get(">i2")).toBeInstanceOf(Int16Array);
	expect(get("<i4")).toBeInstanceOf(Int32Array);
	expect(get(">i4")).toBeInstanceOf(Int32Array);
	expect(get("<i8")).toBeInstanceOf(BigInt64Array);
	expect(get(">i8")).toBeInstanceOf(BigInt64Array);

	expect(get("|u1")).toBeInstanceOf(Uint8Array);
	expect(get("<u2")).toBeInstanceOf(Uint16Array);
	expect(get(">u2")).toBeInstanceOf(Uint16Array);
	expect(get("<u4")).toBeInstanceOf(Uint32Array);
	expect(get(">u4")).toBeInstanceOf(Uint32Array);
	expect(get("<u8")).toBeInstanceOf(BigUint64Array);
	expect(get(">u8")).toBeInstanceOf(BigUint64Array);

	expect(() => get("<f2" as any)).toThrowError();
	expect(() => get(">f2" as any)).toThrowError();
	expect(get("<f4")).toBeInstanceOf(Float32Array);
	expect(get(">f4")).toBeInstanceOf(Float32Array);
	expect(get("<f8")).toBeInstanceOf(Float64Array);
	expect(get(">f8")).toBeInstanceOf(Float64Array);

	expect(get("|b1")).toBeInstanceOf(BoolArray);

	expect(get("<U20")).toBeInstanceOf(UnicodeStringArray);
	expect(get(">U20")).toBeInstanceOf(UnicodeStringArray);
	expect(get(">U20").chars).toBe(20);
	expect(get("<U32").chars).toBe(32);

	expect(get("|S8")).toBeInstanceOf(ByteStringArray);
	expect(get("|S4")).toBeInstanceOf(ByteStringArray);
	expect(get("|S16").chars).toBe(16);
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
		expect(arr).toStrictEqual(expected);
	});
});

test("slice", () => {
	expect(slice(null)).toMatchInlineSnapshot(`
		{
		  "indices": [Function],
		  "start": null,
		  "step": null,
		  "stop": null,
		}
	`);
	expect(slice(null).indices(10)).toMatchInlineSnapshot(`
		[
		  0,
		  10,
		  1,
		]
	`);

	expect(slice(3, 15, 2)).toMatchInlineSnapshot(`
		{
		  "indices": [Function],
		  "start": 3,
		  "step": 2,
		  "stop": 15,
		}
	`);
	expect(slice(3, 15, 2).indices(10)).toMatchInlineSnapshot(`
		[
		  3,
		  10,
		  2,
		]
	`);
	expect(slice(3, 15, 2).indices(30)).toMatchInlineSnapshot(`
		[
		  3,
		  15,
		  2,
		]
	`);

	expect(slice(40)).toMatchInlineSnapshot(`
		{
		  "indices": [Function],
		  "start": null,
		  "step": null,
		  "stop": 40,
		}
	`);
	expect(slice(40).indices(4)).toMatchInlineSnapshot(`
		[
		  0,
		  4,
		  1,
		]
	`);
	expect(slice(40).indices(41)).toMatchInlineSnapshot(`
		[
		  0,
		  40,
		  1,
		]
	`);

	expect(slice(2, 10, -1).indices(20)).toMatchInlineSnapshot(`
		[
		  2,
		  10,
		  -1,
		]
	`);
	expect(slice(2, 10, -1).indices(4)).toMatchInlineSnapshot(`
		[
		  2,
		  3,
		  -1,
		]
	`);

	expect(slice(null, null, -3).indices(14)).toMatchInlineSnapshot(`
		[
		  13,
		  -1,
		  -3,
		]
	`);
	expect(slice(null, null, -3).indices(14)).toMatchInlineSnapshot(`
		[
		  13,
		  -1,
		  -3,
		]
	`);
	expect(slice(null, null, -3).indices(2)).toMatchInlineSnapshot(`
		[
		  1,
		  -1,
		  -3,
		]
	`);

	expect(() => slice(null, null, 0).indices(1)).toThrowError();
});

test("range", () => {
	expect(range(4)).toMatchInlineSnapshot('{}');
	expect(range(0, 10, 2)).toMatchInlineSnapshot('{}');
	expect(range(0, 10, 3)).toMatchInlineSnapshot('{}');
	expect(range(0, 2, 3)).toMatchInlineSnapshot('{}');
	expect(range(0)).toMatchInlineSnapshot('{}');
});

test("get_strides", () => {
	expect(get_strides([3], "C")).toStrictEqual([1]);
	expect(get_strides([3], "F")).toStrictEqual([1]);

	expect(get_strides([3, 4], "C")).toStrictEqual([4, 1]);
	expect(get_strides([3, 4], "F")).toStrictEqual([1, 3]);

	expect(get_strides([3, 4, 10], "C")).toStrictEqual([40, 10, 1]);
	expect(get_strides([3, 4, 10], "F")).toStrictEqual([1, 3, 12]);

	expect(get_strides([3, 4, 10, 2], "C")).toStrictEqual([80, 20, 2, 1]);
	expect(get_strides([3, 4, 10, 2], "F")).toStrictEqual([1, 3, 12, 120]);
});
