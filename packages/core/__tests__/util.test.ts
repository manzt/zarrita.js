import { describe, expect, test } from "vitest";

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
	// ByteStringArray,
	// UnicodeStringArray,
} from "@zarrita/typedarray";

describe("get_ctr", () => {
	test.each([
		["int8", Int8Array],
		["int16", Int16Array],
		["int32", Int32Array],
		["int64", BigInt64Array],
		["uint8", Uint8Array],
		["uint16", Uint16Array],
		["uint32", Uint32Array],
		["uint64", BigUint64Array],
		["float32", Float32Array],
		["float64", Float64Array],
		["bool", BoolArray],
	])(`%s -> %o`, (dtype, ctr) => {
		const T = get_ctr(dtype as DataType);
		expect(new T(1)).toBeInstanceOf(ctr);
	});

	test.each([
		"float16",
	])("%s -> throws", (dtype) => {
		expect(() => get_ctr(dtype as DataType)).toThrowError();
	});
});

describe("byteswap_inplace", () => {
	test.each([
		new Uint32Array([1, 2, 3, 4, 5]),
		new Float64Array([20, 3333, 444.4, 222, 3123]),
		new Float32Array([1, 2, 3, 42, 5]),
		new Uint8Array([1, 2, 3, 4]),
		new Int8Array([-3, 2, 3, 10]),
	])(`%o`, (arr) => {
		// make a copy and then byteswap original twice
		const expected = arr.slice();
		byteswap_inplace(arr);
		byteswap_inplace(arr);
		expect(arr).toStrictEqual(expected);
	});
});

describe("slice", () => {
	test("slice(null)", () => {
		expect(slice(null)).toMatchInlineSnapshot(`
			{
			  "indices": [Function],
			  "start": null,
			  "step": null,
			  "stop": null,
			}
		`);
	});

	test("slice(null).indices(10)", () => {
		expect(slice(null).indices(10)).toStrictEqual([0, 10, 1]);
	});

	test("slice(3, 15, 2)", () => {
		expect(slice(3, 15, 2)).toMatchInlineSnapshot(`
			{
			  "indices": [Function],
			  "start": 3,
			  "step": 2,
			  "stop": 15,
			}
		`);
	});

	test("slice(3, 15, 2).indices(10)", () => {
		expect(slice(3, 15, 2).indices(10)).toStrictEqual([3, 10, 2]);
	});

	test("slice(3, 15, 2).indices(30)", () => {
		expect(slice(3, 15, 2).indices(30)).toStrictEqual([3, 15, 2]);
	});

	test("slice(40)", () => {
		expect(slice(40)).toMatchInlineSnapshot(`
			{
			  "indices": [Function],
			  "start": null,
			  "step": null,
			  "stop": 40,
			}
		`);
	});

	test("slice(40).indices(10)", () => {
		expect(slice(40).indices(4)).toStrictEqual([0, 4, 1]);
	});

	test("slice(40).indices(41)", () => {
		expect(slice(40).indices(41)).toStrictEqual([0, 40, 1]);
	});
});

describe("slice indices", () => {
	test.each([
		[null, 10, [0, 10, 1]],
		[40, 4, [0, 4, 1]],
		[40, 41, [0, 40, 1]],
	])("slice(%o).indices(%i) -> %o", (arg, indices, expected) => {
		expect(slice(arg).indices(indices)).toStrictEqual(expected);
	});

	test.each([
		[3, 15, 2, 10, [3, 10, 2]],
		[3, 15, 2, 30, [3, 15, 2]],
		[2, 10, -1, 20, [2, 10, -1]],
		[2, 10, -1, 4, [2, 3, -1]],
		[null, null, -3, 14, [13, -1, -3]],
		[null, null, -3, 2, [1, -1, -3]],
	])(
		"slice(%o, %o, %o).indices(%i) -> %o",
		(start, stop, step, indices, expected) => {
			expect(slice(start, stop, step).indices(indices)).toStrictEqual(expected);
		},
	);

	test.each([
		[null, null, 0, 1],
	])(
		`slice(%o, %o, %o).indices(%i) -> throws`,
		(start, stop, step, indices) => {
			expect(() => slice(start, stop, step).indices(indices)).toThrowError();
		},
	);
});

describe("range", () => {
	test.each([
		[4, [0, 1, 2, 3]],
		[0, []],
	])(`range(%i) -> %o`, (stop, expected) => {
		expect(Array.from(range(stop))).toStrictEqual(expected);
	});

	test.each([
		[0, 10, 2, [0, 2, 4, 6, 8]],
		[0, 10, 3, [0, 3, 6, 9]],
		[0, 2, 3, [0]],
	])("range(%i, %i, %i) -> %o", (start, stop, step, expected) => {
		expect(Array.from(range(start, stop, step))).toStrictEqual(expected);
	});
});

describe("get_strides", () => {
	test.each<[number[], "C" | "F", number[]]>([
		[[3], "C", [1]],
		[[3], "F", [1]],
		[[3, 4], "C", [4, 1]],
		[[3, 4], "F", [1, 3]],
		[[3, 4, 10], "C", [40, 10, 1]],
		[[3, 4, 10], "F", [1, 3, 12]],
		[[3, 4, 10, 2], "C", [80, 20, 2, 1]],
		[[3, 4, 10, 2], "F", [1, 3, 12, 120]],
	])("get_strides(%o, %s) -> %o", (shape, order, expected) => {
		expect(get_strides(shape, order)).toStrictEqual(expected);
	});
});
