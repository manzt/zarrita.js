import { describe, expect, test } from "vitest";
import { ScaleOffsetCodec } from "../src/codecs/scale_offset.js";

function makeChunk<T extends ArrayBufferView & { length: number }>(data: T) {
	return { data, shape: [data.length], stride: [1] };
}

describe("ScaleOffsetCodec", () => {
	test("decode int32 with scale=2, offset=10", () => {
		const codec = ScaleOffsetCodec.fromConfig(
			{ scale: 2, offset: 10 },
			{ dataType: "int32" },
		);
		// encoded values: [4, 6, 10, 20]
		// decoded = encoded / scale + offset = [2+10, 3+10, 5+10, 10+10]
		const chunk = makeChunk(new Int32Array([4, 6, 10, 20]));
		const decoded = codec.decode(chunk);
		expect(decoded.data).toStrictEqual(new Int32Array([12, 13, 15, 20]));
	});

	test("decode float64 with scale=0.5, offset=1.0", () => {
		const codec = ScaleOffsetCodec.fromConfig(
			{ scale: 0.5, offset: 1.0 },
			{ dataType: "float64" },
		);
		// decoded = encoded / 0.5 + 1.0 = encoded * 2 + 1.0
		const chunk = makeChunk(new Float64Array([1.0, 2.0, 3.0]));
		const decoded = codec.decode(chunk);
		expect(decoded.data).toStrictEqual(new Float64Array([3.0, 5.0, 7.0]));
	});

	test("decode float32 with scale=1, offset=0 is identity", () => {
		const codec = ScaleOffsetCodec.fromConfig(
			{ scale: 1, offset: 0 },
			{ dataType: "float32" },
		);
		const chunk = makeChunk(new Float32Array([1.5, -2.5, 0.0, 100.0]));
		const original = new Float32Array(chunk.data);
		const decoded = codec.decode(chunk);
		expect(decoded.data).toStrictEqual(original);
	});

	test("decode bigint64 with scale and offset", () => {
		const codec = ScaleOffsetCodec.fromConfig(
			{ scale: 2, offset: 100 },
			{ dataType: "int64" },
		);
		// decoded = encoded / 2n + 100n
		const chunk = makeChunk(new BigInt64Array([10n, 20n, 30n]));
		const decoded = codec.decode(chunk);
		expect(decoded.data).toStrictEqual(new BigInt64Array([105n, 110n, 115n]));
	});

	test("decode biguint64 with scale and offset", () => {
		const codec = ScaleOffsetCodec.fromConfig(
			{ scale: 3, offset: 0 },
			{ dataType: "uint64" },
		);
		const chunk = makeChunk(new BigUint64Array([9n, 12n, 15n]));
		const decoded = codec.decode(chunk);
		expect(decoded.data).toStrictEqual(new BigUint64Array([3n, 4n, 5n]));
	});

	test("shape and stride are preserved", () => {
		const codec = ScaleOffsetCodec.fromConfig(
			{ scale: 1, offset: 0 },
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
		const codec = ScaleOffsetCodec.fromConfig(
			{ scale: 2, offset: 0 },
			{ dataType: "int32" },
		);
		const chunk = makeChunk(new Int32Array([1, 2, 3]));
		expect(() => codec.encode(chunk)).toThrow();
	});

	test("empty configuration defaults to scale=1, offset=0 (identity)", () => {
		const codec = ScaleOffsetCodec.fromConfig({}, { dataType: "float64" });
		const chunk = makeChunk(new Float64Array([1.5, -2.5, 0.0, 100.0]));
		const original = new Float64Array(chunk.data);
		const decoded = codec.decode(chunk);
		expect(decoded.data).toStrictEqual(original);
	});

	test("throws for unsupported data type", () => {
		expect(() =>
			ScaleOffsetCodec.fromConfig(
				{ scale: 1, offset: 0 },
				{ dataType: "bool" as never },
			),
		).toThrow();
	});

	describe("JsonScalar parsing", () => {
		test("special float string 'NaN' as offset", () => {
			const codec = ScaleOffsetCodec.fromConfig(
				{ scale: 1, offset: "NaN" },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([1.0, 2.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBeNaN();
			expect(decoded.data[1]).toBeNaN();
		});

		test("special float string 'Infinity' as scale", () => {
			const codec = ScaleOffsetCodec.fromConfig(
				{ scale: "Infinity", offset: 0 },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([5.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data[0]).toBe(0);
		});

		test("hex-encoded float32 scale", () => {
			// 0x40000000 is the IEEE 754 representation of 2.0 as float32
			const codec = ScaleOffsetCodec.fromConfig(
				{ scale: "0x40000000", offset: 0 },
				{ dataType: "float32" },
			);
			const chunk = makeChunk(new Float32Array([4.0, 6.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float32Array([2.0, 3.0]));
		});

		test("hex-encoded float64 scale", () => {
			// 0x4000000000000000 is the IEEE 754 representation of 2.0 as float64
			const codec = ScaleOffsetCodec.fromConfig(
				{ scale: "0x4000000000000000", offset: 0 },
				{ dataType: "float64" },
			);
			const chunk = makeChunk(new Float64Array([4.0, 6.0]));
			const decoded = codec.decode(chunk);
			expect(decoded.data).toStrictEqual(new Float64Array([2.0, 3.0]));
		});

		test("rejects float value for integer data type", () => {
			expect(() =>
				ScaleOffsetCodec.fromConfig(
					{ scale: 1.5, offset: 0 },
					{ dataType: "int32" },
				),
			).toThrow();
		});

		test("rejects hex string for integer data type", () => {
			expect(() =>
				ScaleOffsetCodec.fromConfig(
					{ scale: "0x40000000", offset: 0 },
					{ dataType: "int32" },
				),
			).toThrow();
		});

		test("rejects special float string for integer data type", () => {
			expect(() =>
				ScaleOffsetCodec.fromConfig(
					{ scale: "NaN", offset: 0 },
					{ dataType: "uint16" },
				),
			).toThrow();
		});

		test("rejects non-integer number for bigint data type", () => {
			expect(() =>
				ScaleOffsetCodec.fromConfig(
					{ scale: 1.5, offset: 0 },
					{ dataType: "int64" },
				),
			).toThrow();
		});
	});
});
