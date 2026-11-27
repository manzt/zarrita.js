import { describe, expect, test } from "vitest";

import type { Struct } from "../src/metadata.js";
import {
	BoolArray,
	ByteStringArray,
	byteswapStructInplace,
	StructArray,
	UnicodeStringArray,
} from "../src/typedarray.js";

describe("BoolArray.constructor", () => {
	test("new (size: number) -> BoolArray", () => {
		let arr = new BoolArray(5);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			data: Array.from(arr),
		}).toMatchInlineSnapshot(`
			{
			  "BYTES_PER_ELEMENT": 1,
			  "byteLength": 5,
			  "byteOffset": 0,
			  "data": [
			    false,
			    false,
			    false,
			    false,
			    false,
			  ],
			  "length": 5,
			}
		`);
	});

	test("new (buffer: ArrayBuffer) -> BoolArray", () => {
		let arr = new BoolArray(new Uint8Array([1, 1, 0, 0, 1]).buffer, 1, 3);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			data: Array.from(arr),
		}).toMatchInlineSnapshot(`
			{
			  "BYTES_PER_ELEMENT": 1,
			  "byteLength": 3,
			  "byteOffset": 1,
			  "data": [
			    true,
			    false,
			    false,
			  ],
			  "length": 3,
			}
		`);
	});

	test("new (buffer: ArrayBuffer, byteOffset: number, length: number) -> BoolArray", () => {
		let arr = new BoolArray(new Uint8Array([0, 0, 1, 1, 0, 0, 1]).buffer, 2, 4);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			data: Array.from(arr),
		}).toMatchInlineSnapshot(`
			{
			  "BYTES_PER_ELEMENT": 1,
			  "byteLength": 4,
			  "byteOffset": 2,
			  "data": [
			    true,
			    true,
			    false,
			    false,
			  ],
			  "length": 4,
			}
		`);
	});

	test("new (values: Iterable<boolean>) -> BoolArray", () => {
		let arr = new BoolArray(
			(function* () {
				yield* [true, true, false, false, true];
			})(),
		);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			data: Array.from(arr),
		}).toMatchInlineSnapshot(`
			{
			  "BYTES_PER_ELEMENT": 1,
			  "byteLength": 5,
			  "byteOffset": 0,
			  "data": [
			    true,
			    true,
			    false,
			    false,
			    true,
			  ],
			  "length": 5,
			}
		`);
	});

	test("get(idx) -> boolean", () => {
		let arr = new BoolArray(new Uint8Array([1, 1, 0, 0, 1]).buffer);
		expect([
			arr.get(0),
			arr.get(1),
			arr.get(2),
			arr.get(3),
			arr.get(4),
			arr.get(5),
		]).toMatchInlineSnapshot(`
			[
			  true,
			  true,
			  false,
			  false,
			  true,
			  undefined,
			]
		`);
	});

	test("set(idx, value) -> void", () => {
		let arr = new BoolArray(5);
		[true, true, false, false, true].forEach((v, idx) => {
			arr.set(idx, v);
		});
		expect(new Uint8Array(arr.buffer)).toMatchInlineSnapshot(`
			Uint8Array [
			  1,
			  1,
			  0,
			  0,
			  1,
			]
		`);
	});

	test("fill(true) -> void", () => {
		let arr = new BoolArray(5);
		arr.fill(true);
		expect(new Uint8Array(arr.buffer)).toMatchInlineSnapshot(`
			Uint8Array [
			  1,
			  1,
			  1,
			  1,
			  1,
			]
		`);
	});
});

describe("ByteStringArray", () => {
	test("new (size: number) -> ByteStringArray", () => {
		let arr = new ByteStringArray(10, 5);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			data: Array.from(arr),
		}).toMatchInlineSnapshot(`
			{
			  "BYTES_PER_ELEMENT": 10,
			  "byteLength": 50,
			  "byteOffset": 0,
			  "data": [
			    "",
			    "",
			    "",
			    "",
			    "",
			  ],
			  "length": 5,
			}
		`);
	});

	test("new (buffer: ArrayBuffer, byteOffset: number, length: number) -> ByteStringArray", () => {
		let data = new TextEncoder().encode(
			"Hello\x00world!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00",
		);
		let buffer: ArrayBuffer = data.buffer;
		let arr = new ByteStringArray(2, buffer, 3, 4);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			data: Array.from(arr),
		}).toMatchInlineSnapshot(`
			{
			  "BYTES_PER_ELEMENT": 2,
			  "byteLength": 8,
			  "byteOffset": 3,
			  "data": [
			    "lo",
			    "w",
			    "or",
			    "ld",
			  ],
			  "length": 4,
			}
		`);
	});

	test("new (values: Iterable<string>) -> ByteStringArray", () => {
		let data = ["Hello", "world!", "", "", ""];
		let arr = new ByteStringArray(6, data[Symbol.iterator]());
		expect({
			length: arr.length,
			data: Array.from(arr),
			text: new TextDecoder().decode(arr.buffer as ArrayBuffer),
		}).toStrictEqual({
			length: 5,
			data,
			text: "Hello\x00world!\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00",
		});
	});

	test("get(idx: number) -> string", () => {
		let data = ["Hello", "world!", "", "", ""];
		let arr = new ByteStringArray(6, data[Symbol.iterator]());
		expect(Array.from(data, (_, i) => arr.get(i))).toStrictEqual(data);
	});

	test("get(idx: number) -> throws", () => {
		let data = ["Hello", "world!", "", "", ""];
		let arr = new ByteStringArray(6, data[Symbol.iterator]());
		expect(() => arr.get(5)).toThrow();
	});

	test("set(idx: number, value: string) -> void", () => {
		let expected = ["what", "is", "the", "meaning", "of", "life?"];
		let arr = new ByteStringArray(7, expected.length);
		expected.forEach((v, idx) => {
			arr.set(idx, v);
		});
		expect(Array.from(arr)).toStrictEqual(expected);
	});

	test("fill(value: string) -> void", () => {
		let arr = new ByteStringArray(3, 5);
		arr.fill("foo");
		expect(Array.from(arr)).toStrictEqual(["foo", "foo", "foo", "foo", "foo"]);
	});
});

describe("UnicodeStringArray", () => {
	test("new (size: number) -> UnicodeStringArray", () => {
		let arr = new UnicodeStringArray(10, 5);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			data: Array.from(arr),
		}).toStrictEqual({
			length: 5,
			BYTES_PER_ELEMENT: 10 * 4,
			byteOffset: 0,
			byteLength: 5 * 10 * 4,
			data: ["", "", "", "", ""],
		});
	});

	test("new (buffer: ArrayBuffer, byteOffset: number, length: number) -> UnicodeStringArray", () => {
		// biome-ignore format: the array should not be formatted
		let data = new Int32Array([161, 72, 111, 108, 97, 32, 109, 117, 110, 100, 111, 33, 0, 0, 0, 0, 0, 0, 0, 0, 72, 101, 106, 32, 86, 228, 114, 108, 100, 101, 110, 33, 0, 0, 0, 0, 0, 0, 0, 0, 88, 105, 110, 32, 99, 104, 224, 111, 32, 116, 104, 7871, 32, 103, 105, 7899, 105, 0, 0, 0]);
		let chars = 20;
		let arr = new UnicodeStringArray(chars, data.buffer, chars * 4, 2);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			data: Array.from(arr),
		}).toStrictEqual({
			length: 2,
			BYTES_PER_ELEMENT: chars * 4,
			byteOffset: chars * 4,
			byteLength: chars * 4 * 2,
			data: ["Hej Världen!", "Xin chào thế giới"],
		});
	});

	test("new (values: Iterable<string>) -> UnicodeStringArray", () => {
		let chars = 20;
		let data = ["¡Hola mundo!", "Hej Världen!", "Xin chào thế giới"];
		let arr = new UnicodeStringArray(20, data);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			encoded: new Int32Array(
				arr.buffer,
				arr.byteOffset,
				arr.byteLength / Int32Array.BYTES_PER_ELEMENT,
			),
			encoded_sub_view: new Int32Array(
				arr.buffer,
				arr.byteOffset + arr.BYTES_PER_ELEMENT,
				chars,
			),
		}).toStrictEqual({
			length: data.length,
			BYTES_PER_ELEMENT: chars * Int32Array.BYTES_PER_ELEMENT,
			byteOffset: 0,
			byteLength: data.length * chars * Int32Array.BYTES_PER_ELEMENT,
			// biome-ignore format: the array should not be formatted
			encoded: new Int32Array([
				161, 72, 111, 108, 97, 32, 109, 117, 110, 100, 111, 33, 0, 0, 0, 0, 0, 0, 0, 0,
				72, 101, 106, 32, 86, 228, 114, 108, 100, 101, 110, 33, 0, 0, 0, 0, 0, 0, 0, 0,
				88, 105, 110, 32, 99, 104, 224, 111, 32, 116, 104, 7871, 32, 103, 105, 7899, 105, 0, 0, 0,
			]),
			// biome-ignore format: the array should not be formatted
			encoded_sub_view: new Int32Array([
				72, 101, 106, 32, 86, 228, 114, 108, 100, 101, 110, 33, 0, 0, 0, 0, 0, 0, 0, 0,
			]),
		});
	});

	test("get(idx) -> string", () => {
		let data = ["¡Hola mundo!", "Hej Världen!", "Xin chào thế giới"];
		let arr = new UnicodeStringArray(20, data[Symbol.iterator]());
		expect(Array.from(data, (_, i) => arr.get(i))).toStrictEqual(data);
	});

	test("get(idx) -> throws", () => {
		let arr = new UnicodeStringArray(20, 3);
		expect(() => arr.get(3)).toThrow();
	});

	test("set(idx, value) -> void", () => {
		let expected = ["what", "is", "the", "meaning", "of", "life?"];
		let arr = new UnicodeStringArray(7, expected.length);
		expected.forEach((v, idx) => {
			arr.set(idx, v);
		});
		expect(Array.from(arr)).toStrictEqual(expected);
	});

	test("fill('foo') -> void", () => {
		let arr = new UnicodeStringArray(3, 5);
		arr.fill("foo");
		expect(Array.from(arr)).toStrictEqual(["foo", "foo", "foo", "foo", "foo"]);
	});
});

describe("StructArray", () => {
	// 4 + 1 + 8 = 13 bytes, packed: the layout in the `struct` specification.
	let dtype: Struct = {
		name: "struct",
		configuration: {
			fields: [
				{ name: "id", data_type: "int32" },
				{ name: "flags", data_type: "uint8" },
				{ name: "value", data_type: "float64" },
			],
		},
	};

	test("new (dtype, size: number) -> StructArray", () => {
		let arr = new StructArray(dtype, 2);
		expect({
			length: arr.length,
			BYTES_PER_ELEMENT: arr.BYTES_PER_ELEMENT,
			byteOffset: arr.byteOffset,
			byteLength: arr.byteLength,
			data: Array.from(arr),
		}).toStrictEqual({
			length: 2,
			BYTES_PER_ELEMENT: 13,
			byteOffset: 0,
			byteLength: 26,
			data: [
				{ id: 0, flags: 0, value: 0 },
				{ id: 0, flags: 0, value: 0 },
			],
		});
	});

	test("new (dtype, buffer: ArrayBuffer) -> StructArray", () => {
		let bytes = new Uint8Array(1 + 2 * 13);
		let view = new DataView(bytes.buffer);
		// The first record starts at byte 1, which no typed array of int32 or
		// float64 could, and its fields are packed.
		view.setInt32(1, -2, true);
		view.setUint8(5, 255);
		view.setFloat64(6, 1.5, true);
		view.setInt32(14, 7, true);
		let arr = new StructArray(dtype, bytes.buffer, 1, 2);
		expect(arr.byteOffset).toBe(1);
		expect(arr.length).toBe(2);
		expect(Array.from(arr)).toStrictEqual([
			{ id: -2, flags: 255, value: 1.5 },
			{ id: 7, flags: 0, value: 0 },
		]);
	});

	test("new (dtype, values: Iterable) -> StructArray", () => {
		let values = [
			{ id: 1, flags: 2, value: 0.25 },
			{ id: -1, flags: 3, value: Number.NaN },
		];
		let arr = new StructArray(dtype, values);
		expect(arr.length).toBe(2);
		expect(Array.from(arr)).toStrictEqual(values);
	});

	test("set, get, and fill", () => {
		let arr = new StructArray(dtype, 3);
		arr.fill({ id: 4, flags: 1, value: -1 });
		arr.set(1, { id: 5, flags: 0, value: 2 });
		expect(arr.get(0)).toStrictEqual({ id: 4, flags: 1, value: -1 });
		expect(arr.get(1)).toStrictEqual({ id: 5, flags: 0, value: 2 });
		expect(arr.get(2)).toStrictEqual({ id: 4, flags: 1, value: -1 });
		// A record needs every field.
		expect(() => arr.set(0, { id: 1, flags: 1 })).toThrow(
			"Missing struct field: value",
		);
	});

	test("every kind of field, and a nested struct", () => {
		let all: Struct = {
			name: "struct",
			configuration: {
				fields: [
					{ name: "i1", data_type: "int8" },
					{ name: "u2", data_type: "uint16" },
					{ name: "i8", data_type: "int64" },
					{ name: "u8", data_type: "uint64" },
					{ name: "f4", data_type: "float32" },
					{ name: "ok", data_type: "bool" },
					{
						name: "label",
						data_type: {
							name: "fixed_length_utf32",
							configuration: { length_bytes: 12 },
						},
					},
					{
						name: "tag",
						data_type: {
							name: "null_terminated_bytes",
							configuration: { length_bytes: 4 },
						},
					},
					{
						name: "point",
						data_type: {
							name: "struct",
							configuration: {
								fields: [
									{ name: "x", data_type: "float32" },
									{ name: "y", data_type: "float32" },
								],
							},
						},
					},
				],
			},
		};
		let value = {
			i1: -3,
			u2: 65535,
			i8: -(2n ** 62n),
			u8: 2n ** 63n,
			f4: 0.5,
			ok: true,
			label: "a\u{1F600}b",
			tag: "xyz",
			point: { x: 1, y: 2 },
		};
		let arr = new StructArray(all, [value]);
		expect(arr.BYTES_PER_ELEMENT).toBe(1 + 2 + 8 + 8 + 4 + 1 + 12 + 4 + 8);
		expect(arr.get(0)).toStrictEqual(value);
		// Strings longer than the field are cut to fit.
		arr.set(0, { ...value, label: "abcdef", tag: "abcdef" });
		expect(arr.get(0).label).toBe("abc");
		expect(arr.get(0).tag).toBe("abcd");
	});

	test("reverses the bytes of each field, not of the record", () => {
		let arr = new StructArray(dtype, [{ id: 1, flags: 2, value: 1.5 }]);
		let bytes = new Uint8Array(arr.buffer).slice();
		byteswapStructInplace(bytes, dtype);
		let view = new DataView(bytes.buffer);
		expect(view.getInt32(0, false)).toBe(1);
		expect(view.getUint8(4)).toBe(2);
		expect(view.getFloat64(5, false)).toBe(1.5);
	});

	test("refuses metadata it cannot read", () => {
		let struct = (fields: unknown): Struct =>
			({ name: "struct", configuration: { fields } }) as Struct;
		expect(() => new StructArray(struct([]), 0)).toThrow(
			"A struct data type needs fields",
		);
		expect(
			() => new StructArray(struct([{ name: "t", data_type: "string" }]), 0),
		).toThrow('Unknown or unsupported struct field data type: "string"');
		expect(
			() =>
				new StructArray(
					struct([
						{ name: "a", data_type: "int8" },
						{ name: "a", data_type: "int8" },
					]),
					0,
				),
		).toThrow('Struct field names must be unique: "a"');
	});
});
