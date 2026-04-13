import { describe, expect, test } from "vitest";
import { CastValueCodec } from "../src/codecs/cast_value.js";
import { createCodecPipeline } from "../src/codecs.js";

function makeChunk<T extends ArrayBufferView & { length: number }>(data: T) {
	return { data, shape: [data.length], stride: [1] };
}

// Convention: test names "X -> Y" mean "stored as X, decoded to logical Y".
// fromConfig: dataType = logical (Y), data_type = stored (X).
// Input chunk uses X's TypedArray, output uses Y's.

describe("CastValueCodec", () => {
	describe("float -> int", () => {
		test("float64 -> int32, nearest-even (default)", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(
				new Float64Array([1.0, 2.5, 3.5, -0.7, -1.5, -2.5, -3.5, 0.5]),
			);
			const decoded = codec.decode(chunk);
			// nearest-even: ties go to even neighbor
			// 2.5->2, 3.5->4, -1.5->-2, -2.5->-2, -3.5->-4, 0.5->0
			expect(decoded.data).toStrictEqual(
				new Int32Array([1, 2, 4, -1, -2, -2, -4, 0]),
			);
		});

		test("float64 -> int32, towards-zero", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", rounding: "towards-zero" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Float64Array([1.9, -1.9, 0.1, -0.1]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([1, -1, 0, 0]));
		});

		test("float64 -> int32, towards-positive", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", rounding: "towards-positive" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Float64Array([1.1, -1.9, 0.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([2, -1, 0]));
		});

		test("float64 -> int32, towards-negative", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", rounding: "towards-negative" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Float64Array([1.9, -1.1, 0.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([1, -2, 0]));
		});

		test("float64 -> int32, nearest-away", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", rounding: "nearest-away" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Float64Array([2.5, 3.5, -2.5, -3.5]));
			const decoded = codec.decode(chunk);
			// ties go away from zero
			expect(decoded.data).toStrictEqual(new Int32Array([3, 4, -3, -4]));
		});

		test("float64 -> uint8 with clamp", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", out_of_range: "clamp" },
				{ dataType: "uint8" },
			);
			const chunk = makeChunk(new Float64Array([0, 255, 300, -10, 128.7]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Uint8Array([0, 255, 255, 0, 129]));
		});

		test("float64 -> int8 with wrap", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", out_of_range: "wrap" },
				{ dataType: "int8" },
			);
			const chunk = makeChunk(new Float64Array([128, -129]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int8Array([-128, 127]));
		});

		test("float -> int rejects NaN", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Float64Array([NaN]));
			expect(() => codec.decode(chunk)).toThrow();
		});

		test("float -> int rejects Infinity", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Float64Array([Infinity]));
			expect(() => codec.decode(chunk)).toThrow();
		});

		test("float -> int rejects out-of-range without mode", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "uint8" },
			);
			const chunk = makeChunk(new Float64Array([300]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("float -> bigint", () => {
		test("float64 -> int64, nearest-even (default)", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new Float64Array([1.0, -2.0, 100.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([1n, -2n, 100n]));
		});

		test("float64 -> int64, towards-zero", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", rounding: "towards-zero" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new Float64Array([1.9, -1.9]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([1n, -1n]));
		});

		test("float64 -> int64, towards-positive", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", rounding: "towards-positive" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new Float64Array([1.1, -1.9]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([2n, -1n]));
		});

		test("float64 -> int64, towards-negative", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", rounding: "towards-negative" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new Float64Array([1.9, -1.1]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([1n, -2n]));
		});

		test("float64 -> int64, nearest-away", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", rounding: "nearest-away" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new Float64Array([2.5, -2.5]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([3n, -3n]));
		});

		test("float64 -> uint64 with clamp", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64", out_of_range: "clamp" },
				{ dataType: "uint64" },
			);
			const chunk = makeChunk(new Float64Array([100, -10]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigUint64Array([100n, 0n]));
		});

		test("float64 -> int64 rejects NaN", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new Float64Array([NaN]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("int -> float", () => {
		test("int32 -> float64", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Int32Array([1, -2, 2147483647]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(
				new Float64Array([1.0, -2.0, 2147483647.0]),
			);
		});

		test("uint8 -> float32", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "uint8" },
				{ dataType: "float32" },
			);
			const chunk = makeChunk(new Uint8Array([0, 128, 255]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float32Array([0, 128, 255]));
		});
	});

	describe("bigint -> float", () => {
		test("int64 -> float64", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int64" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new BigInt64Array([1n, -2n, 100n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float64Array([1.0, -2.0, 100.0]));
		});
	});

	describe("int -> int", () => {
		test("int32 -> int16 in range", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "int16" },
			);
			const chunk = makeChunk(new Int32Array([0, 100, -100, 32767, -32768]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(
				new Int16Array([0, 100, -100, 32767, -32768]),
			);
		});

		test("int32 -> uint8 with clamp", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32", out_of_range: "clamp" },
				{ dataType: "uint8" },
			);
			const chunk = makeChunk(new Int32Array([-10, 0, 128, 300]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Uint8Array([0, 0, 128, 255]));
		});

		test("int32 -> int8 with wrap", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32", out_of_range: "wrap" },
				{ dataType: "int8" },
			);
			const chunk = makeChunk(new Int32Array([128, 256, -129]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int8Array([-128, 0, 127]));
		});

		test("int -> int rejects out-of-range without mode", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "uint8" },
			);
			const chunk = makeChunk(new Int32Array([256]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("int -> bigint", () => {
		test("int32 -> int64", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new Int32Array([1, -2, 2147483647]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(
				new BigInt64Array([1n, -2n, 2147483647n]),
			);
		});

		test("int32 -> uint64 with clamp", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32", out_of_range: "clamp" },
				{ dataType: "uint64" },
			);
			const chunk = makeChunk(new Int32Array([-1, 0, 100]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigUint64Array([0n, 0n, 100n]));
		});

		test("int32 -> uint64 rejects out-of-range without mode", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "uint64" },
			);
			const chunk = makeChunk(new Int32Array([-1]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("bigint -> int", () => {
		test("int64 -> int32 in range", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int64" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new BigInt64Array([1n, -2n, 100n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([1, -2, 100]));
		});

		test("int64 -> uint8 with clamp", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int64", out_of_range: "clamp" },
				{ dataType: "uint8" },
			);
			const chunk = makeChunk(new BigInt64Array([-1n, 0n, 255n, 1000n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Uint8Array([0, 0, 255, 255]));
		});

		test("int64 -> int8 with wrap", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int64", out_of_range: "wrap" },
				{ dataType: "int8" },
			);
			const chunk = makeChunk(new BigInt64Array([128n, -129n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int8Array([-128, 127]));
		});

		test("int64 -> int32 rejects out-of-range without mode", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int64" },
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new BigInt64Array([2147483648n]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("bigint -> bigint", () => {
		test("uint64 -> int64 in range", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "uint64" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new BigUint64Array([0n, 100n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([0n, 100n]));
		});

		test("uint64 -> int64 with clamp", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "uint64", out_of_range: "clamp" },
				{ dataType: "int64" },
			);
			const i64Max = 2n ** 63n - 1n;
			const chunk = makeChunk(new BigUint64Array([0n, i64Max, i64Max + 1n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([0n, i64Max, i64Max]));
		});

		test("uint64 -> int64 with wrap", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "uint64", out_of_range: "wrap" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new BigUint64Array([2n ** 63n]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new BigInt64Array([-(2n ** 63n)]));
		});

		test("uint64 -> int64 rejects out-of-range without mode", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "uint64" },
				{ dataType: "int64" },
			);
			const chunk = makeChunk(new BigUint64Array([2n ** 63n]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("float -> float", () => {
		test("float64 -> float32", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "float32" },
			);
			const chunk = makeChunk(new Float64Array([1.0, -2.5, 0.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float32Array([1.0, -2.5, 0.0]));
		});

		test("float32 -> float64", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float32" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float32Array([1.0, -2.5]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float64Array([1.0, -2.5]));
		});

		test("NaN propagates in float -> float", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "float32" },
			);
			const chunk = makeChunk(new Float64Array([NaN]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBeNaN();
		});

		test("Infinity propagates in float -> float", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "float64" },
				{ dataType: "float32" },
			);
			const chunk = makeChunk(new Float64Array([Infinity, -Infinity]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBe(Infinity);
			expect(decoded.data[1]).toBe(-Infinity);
		});

		test("float -> float rejects non-nearest-even rounding", () => {
			expect(() =>
				CastValueCodec.fromConfig(
					{ data_type: "float64", rounding: "towards-zero" },
					{ dataType: "float32" },
				),
			).toThrow();
		});
	});

	describe("general", () => {
		test("shape and stride are preserved", () => {
			const codec = CastValueCodec.fromConfig(
				{ data_type: "int32" },
				{ dataType: "float64" },
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
				{ data_type: "int32" },
				{ dataType: "float64" },
			);
			const chunk: any = makeChunk(new Int32Array([1]));
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
		test("NaN mapped to 0 via scalar_map in float -> int", () => {
			// stored=float64, logical=int32
			// decode entry: [NaN in float64 (stored), 0 in int32 (logical)]
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "float64",
					scalar_map: { decode: [["NaN", 0]] },
				},
				{ dataType: "int32" },
			);
			const chunk = makeChunk(new Float64Array([NaN, 1.0, 2.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Int32Array([0, 1, 2]));
		});

		test("Infinity and -Infinity mapped via scalar_map", () => {
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "float64",
					scalar_map: {
						decode: [
							["Infinity", 127],
							["-Infinity", -128],
						],
					},
				},
				{ dataType: "int8" },
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

		test("scalar_map with int -> float", () => {
			// stored=int32, logical=float64
			// decode entry: [0 in int32 (stored), NaN in float64 (logical)]
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "int32",
					scalar_map: { decode: [[0, "NaN"]] },
				},
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Int32Array([0, 1, 2]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBeNaN();
			expect(decoded.data[1]).toBe(1.0);
			expect(decoded.data[2]).toBe(2.0);
		});

		test("scalar_map with hex-encoded float target", () => {
			// 0x7fc00000 = NaN as float32
			// stored=int32, logical=float32
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "int32",
					scalar_map: { decode: [[-1, "0x7fc00000"]] },
				},
				{ dataType: "float32" },
			);
			const chunk = makeChunk(new Int32Array([-1, 5]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBeNaN();
			expect(decoded.data[1]).toBe(5);
		});

		test("scalar_map with bigint source", () => {
			// stored=int64 (bigint), logical=int32
			const codec: any = CastValueCodec.fromConfig(
				{
					data_type: "int64",
					scalar_map: { decode: [[-1, 0]] },
				},
				{ dataType: "int32" },
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
			// stored=float64, logical=uint8
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "float64",
					out_of_range: "clamp",
					scalar_map: { decode: [["NaN", 0]] },
				},
				{ dataType: "uint8" },
			);
			const chunk = makeChunk(new Float64Array([NaN, 300, -10, 100]));
			const decoded = codec.decode(chunk);
			// NaN -> 0 via map, 300 -> 255 via clamp, -10 -> 0 via clamp, 100 -> 100
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
			// stored=float64, logical=int8, only encode entries.
			// Encode map: logical 0 -> stored "NaN". This doesn't affect decode.
			const codec = CastValueCodec.fromConfig(
				{
					data_type: "float64",
					scalar_map: { encode: [[0, "NaN"]] },
				},
				{ dataType: "int8" },
			);
			// NaN in stored data without a decode mapping should throw (float -> int)
			const chunk = makeChunk(new Float64Array([NaN]));
			expect(() => codec.decode(chunk)).toThrow();
		});
	});

	describe("fill value propagation", () => {
		test("fill value is cast through encode path", async () => {
			// Logical float64, stored as int32. fill_value=1.5 should be
			// cast to 2 (nearest-even rounding) in the encoded metadata.
			const pipeline = createCodecPipeline({
				dataType: "float64",
				shape: [4],
				codecs: [
					{
						name: "cast_value",
						configuration: { data_type: "int32" },
					},
					{ name: "bytes", configuration: { endian: "little" } },
				],
				fillValue: 1.5,
			});
			const resolved = await pipeline.resolvedFillValue();
			expect(resolved).toBe(2);
		});

		test("fill value is cast through encode scalar_map", async () => {
			// Logical float64, stored as int8. scalar_map encodes NaN->0.
			const pipeline = createCodecPipeline({
				dataType: "float64",
				shape: [4],
				codecs: [
					{
						name: "cast_value",
						configuration: {
							data_type: "int8",
							out_of_range: "clamp",
							scalar_map: {
								encode: [["NaN", 0]],
							},
						},
					},
					{ name: "bytes", configuration: { endian: "little" } },
				],
				fillValue: NaN,
			});
			const resolved = await pipeline.resolvedFillValue();
			expect(resolved).toBe(0);
		});

		test("fill value propagation with identity cast", async () => {
			const pipeline = createCodecPipeline({
				dataType: "int32",
				shape: [4],
				codecs: [
					{
						name: "cast_value",
						configuration: { data_type: "int32" },
					},
					{ name: "bytes", configuration: { endian: "little" } },
				],
				fillValue: 42,
			});
			const resolved = await pipeline.resolvedFillValue();
			expect(resolved).toBe(42);
		});

		test("null fill value passes through", async () => {
			const pipeline = createCodecPipeline({
				dataType: "float64",
				shape: [4],
				codecs: [
					{
						name: "cast_value",
						configuration: { data_type: "int32" },
					},
					{ name: "bytes", configuration: { endian: "little" } },
				],
				fillValue: null,
			});
			const resolved = await pipeline.resolvedFillValue();
			expect(resolved).toBeNull();
		});

		test("fill value without cast_value is unchanged", async () => {
			const pipeline = createCodecPipeline({
				dataType: "int32",
				shape: [4],
				codecs: [
					{ name: "bytes", configuration: { endian: "little" } },
				],
				fillValue: 42,
			});
			const resolved = await pipeline.resolvedFillValue();
			expect(resolved).toBe(42);
		});

		test("resolvedFillValue is the encoded value, not the logical value", async () => {
			// Logical float64 with fill_value=NaN, stored as uint8 via
			// scalar_map encode NaN->0.
			const pipeline = createCodecPipeline({
				dataType: "float64",
				shape: [4],
				codecs: [
					{
						name: "cast_value",
						configuration: {
							data_type: "uint8",
							out_of_range: "clamp",
							scalar_map: { encode: [["NaN", 0]] },
						},
					},
					{ name: "bytes", configuration: { endian: "little" } },
				],
				fillValue: NaN,
			});
			const resolved = await pipeline.resolvedFillValue();
			expect(resolved).toBe(0);
		});

		test("chained cast_value codecs propagate fill value through both", async () => {
			// Array declares dtype float64, fill_value NaN.
			// First cast_value: float64 -> int16, encode scalar_map NaN -> 0.
			// Second cast_value: int16 -> int8, encode scalar_map 0 -> 255.
			//
			// Pipeline metadata flows through loadCodecs:
			//   initial: { dataType: "float64", fillValue: NaN }
			//   after 1st getEncodedMeta: { dataType: "int16", fillValue: 0 }
			//     (NaN mapped to 0 by 1st codec's encode scalar_map)
			//   after 2nd getEncodedMeta: { dataType: "int8", fillValue: 255 }
			//     (0 mapped to 255 by 2nd codec's encode scalar_map)
			//   bytes codec sees: int8 data, fill value 255.
			//
			// Decode flows in reverse:
			//   bytes decodes int8 chunk
			//   2nd cast_value decodes int8 -> int16
			//   1st cast_value decodes int16 -> float64
			const pipeline = createCodecPipeline({
				dataType: "float64",
				shape: [4],
				codecs: [
					{
						name: "cast_value",
						configuration: {
							data_type: "int16",
							scalar_map: {
								encode: [["NaN", 0]],
								decode: [[0, "NaN"]],
							},
						},
					},
					{
						name: "cast_value",
						configuration: {
							data_type: "int8",
							out_of_range: "clamp",
							scalar_map: {
								encode: [[0, -1]],
								decode: [[-1, 0]],
							},
						},
					},
					{ name: "bytes", configuration: { endian: "little" } },
				],
				fillValue: NaN,
			});

			// Fill value propagation: NaN -> 0 -> -1
			const resolved = await pipeline.resolvedFillValue();
			expect(resolved).toBe(-1);

			// Decode a chunk of int8 bytes [1, 2, -1, 3] through the full pipeline:
			//   bytes decodes to Int8Array [1, 2, -1, 3]
			//   2nd cast_value (int8 -> int16): -1 maps to 0 via decode scalar_map
			//     -> Int16Array [1, 2, 0, 3]
			//   1st cast_value (int16 -> float64): 0 maps to NaN via decode scalar_map
			//     -> Float64Array [1, 2, NaN, 3]
			const chunk = await pipeline.decode(new Uint8Array([1, 2, 0xff, 3]));
			expect(chunk.data[0]).toBe(1);
			expect(chunk.data[1]).toBe(2);
			expect(chunk.data[2]).toBeNaN();
			expect(chunk.data[3]).toBe(3);
		});
	});
});
