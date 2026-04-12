import { describe, expect, test } from "vitest";
import { CastValueCodec } from "../src/codecs/cast_value.js";

function makeChunk<T extends ArrayBufferView & { length: number }>(data: T) {
	return { data, shape: [data.length], stride: [1] };
}

describe("CastValueCodec", () => {
	describe("float → int", () => {
		test("float64 → int32, nearest-even (default)", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([1.0, 2.5, 3.5, -0.7]));
			const decoded = codec.decode(chunk);
			// nearest-even: 2.5 → 2 (ties to even), 3.5 → 4 (ties to even)
			// -0.7 → -1 (nearest)
			expect(decoded.data).toStrictEqual(new Int32Array([1, 2, 4, -1]));
		});

		test("float64 → int32, towards-zero", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32", rounding: "towards-zero" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([1.9, -1.9, 0.1, -0.1]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([1, -1, 0, 0]));
		});

		test("float64 → int32, towards-positive", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32", rounding: "towards-positive" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([1.1, -1.9, 0.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([2, -1, 0]));
		});

		test("float64 → int32, towards-negative", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32", rounding: "towards-negative" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([1.9, -1.1, 0.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([1, -2, 0]));
		});

		test("float64 → int32, nearest-away", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32", rounding: "nearest-away" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([2.5, 3.5, -2.5, -3.5]));
			const decoded = codec.decode(chunk);
			// ties go away from zero
			expect(decoded.data).toStrictEqual(new Int32Array([3, 4, -3, -4]));
		});

		test("float64 → uint8 with clamp", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "uint8", out_of_range: "clamp" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([0, 255, 300, -10, 128.7]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Uint8Array([0, 255, 255, 0, 129]));
		});

		test("float64 → int8 with wrap", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int8", out_of_range: "wrap" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([128, -129]));
			const decoded = codec.decode(chunk);
			// 128 wraps: ((128 - (-128)) % 256 + 256) % 256 + (-128) = -128
			// -129 wraps: ((-129 - (-128)) % 256 + 256) % 256 + (-128) = 127
			expect(decoded.data).toStrictEqual(new Int8Array([-128, 127]));
		});

		test("float → int rejects NaN", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([NaN]));
			expect(() => codec.decode(chunk)).toThrow();
		});

		test("float → int rejects Infinity", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([Infinity]));
			expect(() => codec.decode(chunk)).toThrow();
		});

		test("float → int rejects out-of-range without mode", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "uint8" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([300]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("float → bigint", () => {
		test("float64 → int64", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int64" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([1.0, -2.0, 100.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([1n, -2n, 100n]));
		});
	});

	describe("int → float", () => {
		test("int32 → float64", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([1, -2, 2147483647]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(
				new Float64Array([1.0, -2.0, 2147483647.0]),
			);
		});

		test("uint8 → float32", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float32" },
				{ dataType: "uint8" },
			);
			const chunk = makeChunk(new Uint8Array([0, 128, 255]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float32Array([0, 128, 255]));
		});
	});

	describe("bigint → float", () => {
		test("int64 → float64", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new BigInt64Array([1n, -2n, 100n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float64Array([1.0, -2.0, 100.0]));
		});
	});

	describe("int → int", () => {
		test("int32 → int16 in range", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int16" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([0, 100, -100, 32767, -32768]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(
				new Int16Array([0, 100, -100, 32767, -32768]),
			);
		});

		test("int32 → uint8 with clamp", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "uint8", out_of_range: "clamp" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([-10, 0, 128, 300]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Uint8Array([0, 0, 128, 255]));
		});

		test("int32 → int8 with wrap", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int8", out_of_range: "wrap" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([128, 256, -129]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int8Array([-128, 0, 127]));
		});

		test("int → int rejects out-of-range without mode", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "uint8" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([256]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("int → bigint", () => {
		test("int32 → int64", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int64" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([1, -2, 2147483647]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(
				new BigInt64Array([1n, -2n, 2147483647n]),
			);
		});
	});

	describe("bigint → int", () => {
		test("int64 → int32 in range", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new BigInt64Array([1n, -2n, 100n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([1, -2, 100]));
		});

		test("int64 → int32 rejects out-of-range without mode", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(
				new BigInt64Array([2147483648n]),
			);
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("bigint → bigint", () => {
		test("uint64 → int64 in range", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int64" },
				{ dataType: "uint64" },
			);
			const chunk = makeChunk(new BigUint64Array([0n, 100n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([0n, 100n]));
		});
	});

	describe("float → float", () => {
		test("float64 → float32", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float32" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([1.0, -2.5, 0.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float32Array([1.0, -2.5, 0.0]));
		});

		test("float32 → float64", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "float32" },
			);
			const chunk = makeChunk(new Float32Array([1.0, -2.5]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float64Array([1.0, -2.5]));
		});

		test("NaN propagates in float → float", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float32" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([NaN]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBeNaN();
		});

		test("Infinity propagates in float → float", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float32" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([Infinity, -Infinity]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBe(Infinity);
			expect(decoded.data[1]).toBe(-Infinity);
		});
	});

	describe("general", () => {
		test("shape and stride are preserved", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "int32" },
			);
			const chunk = {
				data: new Int32Array([1, 2, 3, 4, 5, 6]),
				shape: [2, 3],
				stride: [3, 1],
			};
			const decoded = codec.decode(chunk);
			expect(decoded.shape).toStrictEqual([2, 3]);
			expect(decoded.stride).toStrictEqual([3, 1]);
		});

		test("encode always throws", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Float64Array([1.0]));
			expect(() => codec.encode(chunk)).toThrow();
		});

		test("throws for unsupported source data type", () => {
			expect(() =>
				CastValueCodec.fromConfig(
					{ data_type: "int32" },
					{ dataType: "bool" as never },
				),
			).toThrow();
		});

		test("throws for unsupported target data type", () => {
			expect(() =>
				CastValueCodec.fromConfig(
					{ data_type: "bool" as never },
					{ dataType: "int32" },
				),
			).toThrow();
		});
	});

	describe("scalar_map", () => {
		test("NaN mapped to 0 via scalar_map in float → int", () => {
			// meta.dataType=float64 (input), data_type=int32 (output)
			// decode entry: [NaN in float64 encoding, 0 in int32 encoding]
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "int32",
					scalar_map: { decode: [["NaN", 0]] },
				},
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([NaN, 1.0, 2.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([0, 1, 2]));
		});

		test("Infinity and -Infinity mapped via scalar_map", () => {
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "int8",
					scalar_map: {
						decode: [
							["Infinity", 127],
							["-Infinity", -128],
						],
					},
				},
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([Infinity, -Infinity, 5.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int8Array([127, -128, 5]));
		});

		test("scalar_map takes precedence over normal conversion", () => {
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "int32",
					scalar_map: { decode: [[999, 0]] },
				},
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([999, 1, 2]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([0, 1, 2]));
		});

		test("scalar_map with int → float", () => {
			// meta.dataType=int32 (input), data_type=float64 (output)
			// decode entry: [0 in int32, NaN in float64]
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "float64",
					scalar_map: { decode: [[0, "NaN"]] },
				},
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([0, 1, 2]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBeNaN();
			expect(decoded.data[1]).toBe(1.0);
			expect(decoded.data[2]).toBe(2.0);
		});

		test("scalar_map with hex-encoded float target", () => {
			// 0x7fc00000 = NaN as float32
			// meta.dataType=int32 (input), data_type=float32 (output)
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "float32",
					scalar_map: { decode: [[-1, "0x7fc00000"]] },
				},
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([-1, 5]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBeNaN();
			expect(decoded.data[1]).toBe(5);
		});

		test("scalar_map with bigint source", () => {
			// meta.dataType=int64 (input, bigint), data_type=int32 (output)
			const codec: any = CastValueCodec.fromConfig(
				{
					data_type: "int32",
					scalar_map: { decode: [[-1, 0]] },
				},
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new BigInt64Array([-1n, 5n, 10n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([0, 5, 10]));
		});

		test("only first match applies for duplicate keys", () => {
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "int32",
					scalar_map: { decode: [[1, 100], [1, 200]] },
				},
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([1, 2]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([100, 2]));
		});

		test("unmapped values use normal conversion pipeline", () => {
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "uint8",
					out_of_range: "clamp",
					scalar_map: { decode: [["NaN", 0]] },
				},
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([NaN, 300, -10, 100]));
			const decoded = codec.decode(chunk);
			// NaN → 0 via map, 300 → 255 via clamp, -10 → 0 via clamp, 100 → 100
			expect(decoded.data).toStrictEqual(new Uint8Array([0, 255, 0, 100]));
		});

		test("empty scalar_map has no effect", () => {
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "int32",
					scalar_map: { decode: [] },
				},
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Int32Array([1, 2, 3]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([1, 2, 3]));
		});

		test("no decode entries means no scalar_map effect", () => {
			// Only encode entries — decode should behave normally
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "int32",
					scalar_map: { encode: [["NaN", 0]] },
				},
				{ dataType: "float64" },
			);
			// NaN without a decode mapping should throw (float → int)
			const chunk = makeChunk(new Float64Array([NaN]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});
});
