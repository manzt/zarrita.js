import { expect, test } from "vitest";

import type { DataType } from "../src/index.js";

import {
	byteswap_inplace,
	get_ctr,
	get_strides,
	range,
	slice,
} from "../src/util.js";

import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";

test("get_ctr", () => {
	// get an instance of returned constructor
	const get = <D extends DataType>(s: D) => new (get_ctr(s))(1);

	expect(get("int8")).toBeInstanceOf(Int8Array);
	expect(get("int16")).toBeInstanceOf(Int16Array);
	expect(get("int32")).toBeInstanceOf(Int32Array);
	expect(get("int64")).toBeInstanceOf(BigInt64Array);

	expect(get("uint8")).toBeInstanceOf(Uint8Array);
	expect(get("uint16")).toBeInstanceOf(Uint16Array);
	expect(get("uint32")).toBeInstanceOf(Uint32Array);
	expect(get("uint64")).toBeInstanceOf(BigUint64Array);

	expect(() => get("float16" as any)).toThrowError();
	expect(get("float32")).toBeInstanceOf(Float32Array);
	expect(get("float64")).toBeInstanceOf(Float64Array);

	expect(get("bool")).toBeInstanceOf(BoolArray);
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
	expect(range(4)).toMatchInlineSnapshot("{}");
	expect(range(0, 10, 2)).toMatchInlineSnapshot("{}");
	expect(range(0, 10, 3)).toMatchInlineSnapshot("{}");
	expect(range(0, 2, 3)).toMatchInlineSnapshot("{}");
	expect(range(0)).toMatchInlineSnapshot("{}");
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
