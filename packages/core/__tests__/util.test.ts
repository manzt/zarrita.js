import { describe, expect, test } from "vitest";
import type { DataType } from "../src/index.js";
import {
	byteswap_inplace,
	get_ctr,
	get_strides,
	is_dtype,
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

describe("is_dtype", () => {
	test.each<[DataType, boolean]>([
		["int8", true],
		["int16", true],
		["int32", true],
		["uint8", true],
		["uint16", true],
		["uint32", true],
		["float32", true],
		["float64", true],
		["bool", false],
		["int64", false],
		["uint64", false],
		["r42", false],
	])("is_dtype(%s, 'number') -> %s", (dtype, expected) => {
		expect(is_dtype(dtype, "number")).toBe(expected);
	});

	test.each<[DataType, boolean]>([
		["int8", false],
		["int16", false],
		["int32", false],
		["uint8", false],
		["uint16", false],
		["uint32", false],
		["float32", false],
		["float64", false],
		["bool", false],
		["int64", true],
		["uint64", true],
		["r42", false],
	])("is_dtype(%s, 'bigint') -> %s", (dtype, expected) => {
		expect(is_dtype(dtype, "bigint")).toBe(expected);
	});

	test.each<[DataType, boolean]>([
		["int8", false],
		["int16", false],
		["int32", false],
		["uint8", false],
		["uint16", false],
		["uint32", false],
		["float32", false],
		["float64", false],
		["bool", false],
		["int64", false],
		["uint64", false],
		["r42", true],
	])("is_dtype(%s, 'raw') -> %s", (dtype, expected) => {
		expect(is_dtype(dtype, "raw")).toBe(expected);
	});

	test.each<DataType>([
		"int8",
		"int16",
		"int32",
		"uint8",
		"uint16",
		"uint32",
		"float32",
		"float64",
		"bool",
		"int64",
		"uint64",
		"r42",
	])("is_dtype(%s, %s) -> true", (dtype) => {
		expect(is_dtype(dtype, dtype)).toBe(true);
	});
});
