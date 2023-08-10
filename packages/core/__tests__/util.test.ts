import { describe, expect, test } from "vitest";
import type { DataType } from "../src/index.js";
import { byteswap_inplace, get_ctr, get_strides } from "../src/util.js";

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
		byteswap_inplace(new Uint8Array(arr.buffer), arr.BYTES_PER_ELEMENT);
		byteswap_inplace(new Uint8Array(arr.buffer), arr.BYTES_PER_ELEMENT);
		expect(arr).toStrictEqual(expected);
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
