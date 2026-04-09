import { describe, expect, it } from "vitest";
import { DeltaCodec } from "../src/codecs/delta.js";
import { ShuffleCodec } from "../src/codecs/shuffle.js";

describe("shuffle", () => {
	it("roundtrips with elementSize=4", () => {
		let codec = ShuffleCodec.fromConfig({ elementsize: 4 });
		let input = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		let encoded = codec.encode(input);
		let decoded = codec.decode(encoded);
		expect(decoded).toEqual(input);
	});

	it("roundtrips with elementSize=2", () => {
		let codec = ShuffleCodec.fromConfig({ elementsize: 2 });
		let input = new Uint8Array([1, 2, 3, 4, 5, 6]);
		let encoded = codec.encode(input);
		let decoded = codec.decode(encoded);
		expect(decoded).toEqual(input);
	});

	it("shuffles bytes correctly", () => {
		let codec = ShuffleCodec.fromConfig({ elementsize: 4 });
		// 3 elements of 4 bytes each: [A0 A1 A2 A3] [B0 B1 B2 B3] [C0 C1 C2 C3]
		let input = new Uint8Array([
			0xa0, 0xa1, 0xa2, 0xa3, 0xb0, 0xb1, 0xb2, 0xb3, 0xc0, 0xc1, 0xc2, 0xc3,
		]);
		let encoded = codec.encode(input);
		// Shuffled: [A0 B0 C0] [A1 B1 C1] [A2 B2 C2] [A3 B3 C3]
		expect(encoded).toEqual(
			new Uint8Array([
				0xa0, 0xb0, 0xc0, 0xa1, 0xb1, 0xc1, 0xa2, 0xb2, 0xc2, 0xa3, 0xb3, 0xc3,
			]),
		);
	});

	it("defaults to elementSize=4", () => {
		let codec = ShuffleCodec.fromConfig({});
		let input = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
		let decoded = codec.decode(codec.encode(input));
		expect(decoded).toEqual(input);
	});
});

describe("delta", () => {
	it("roundtrips int32 data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
		let buf = new ArrayBuffer(16);
		let view = new Int32Array(buf);
		view.set([10, 20, 25, 30]);
		let input = new Uint8Array(buf);
		let encoded = codec.encode(input);
		let decoded = codec.decode(encoded);
		let result = new Int32Array(
			decoded.buffer,
			decoded.byteOffset,
			decoded.byteLength / 4,
		);
		expect(Array.from(result)).toEqual([10, 20, 25, 30]);
	});

	it("encodes as differences", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
		let buf = new ArrayBuffer(16);
		new Int32Array(buf).set([10, 20, 25, 30]);
		let encoded = codec.encode(new Uint8Array(buf));
		let deltas = new Int32Array(
			encoded.buffer,
			encoded.byteOffset,
			encoded.byteLength / 4,
		);
		expect(Array.from(deltas)).toEqual([10, 10, 5, 5]);
	});

	it("roundtrips float32 data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "float32" });
		let buf = new ArrayBuffer(12);
		new Float32Array(buf).set([1.5, 2.5, 4.0]);
		let input = new Uint8Array(buf);
		let decoded = codec.decode(codec.encode(input));
		let result = new Float32Array(
			decoded.buffer,
			decoded.byteOffset,
			decoded.byteLength / 4,
		);
		expect(Array.from(result)).toEqual([1.5, 2.5, 4.0]);
	});

	it("roundtrips int16 data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "int16" });
		let buf = new ArrayBuffer(8);
		new Int16Array(buf).set([100, 200, 150, 300]);
		let input = new Uint8Array(buf);
		let decoded = codec.decode(codec.encode(input));
		let result = new Int16Array(
			decoded.buffer,
			decoded.byteOffset,
			decoded.byteLength / 2,
		);
		expect(Array.from(result)).toEqual([100, 200, 150, 300]);
	});

	it("roundtrips uint16 data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "uint16" });
		let buf = new ArrayBuffer(8);
		new Uint16Array(buf).set([65000, 100, 50000, 40000]);
		let input = new Uint8Array(buf);
		let decoded = codec.decode(codec.encode(input));
		let result = new Uint16Array(
			decoded.buffer,
			decoded.byteOffset,
			decoded.byteLength / 2,
		);
		expect(Array.from(result)).toEqual([65000, 100, 50000, 40000]);
	});

	it("roundtrips uint32 data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "uint32" });
		let buf = new ArrayBuffer(12);
		new Uint32Array(buf).set([3000000000, 100, 4000000000]);
		let input = new Uint8Array(buf);
		let decoded = codec.decode(codec.encode(input));
		let result = new Uint32Array(
			decoded.buffer,
			decoded.byteOffset,
			decoded.byteLength / 4,
		);
		expect(Array.from(result)).toEqual([3000000000, 100, 4000000000]);
	});

	it("roundtrips float64 data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "float64" });
		let buf = new ArrayBuffer(24);
		new Float64Array(buf).set([1.1, 2.2, 3.3]);
		let input = new Uint8Array(buf);
		let decoded = codec.decode(codec.encode(input));
		let result = new Float64Array(
			decoded.buffer,
			decoded.byteOffset,
			decoded.byteLength / 8,
		);
		expect(Array.from(result)).toEqual([1.1, 2.2, 3.3]);
	});

	it("roundtrips int8 data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "int8" });
		let buf = new ArrayBuffer(4);
		new Int8Array(buf).set([-50, 0, 50, 100]);
		let input = new Uint8Array(buf);
		let decoded = codec.decode(codec.encode(input));
		let result = new Int8Array(
			decoded.buffer,
			decoded.byteOffset,
			decoded.byteLength,
		);
		expect(Array.from(result)).toEqual([-50, 0, 50, 100]);
	});

	it("roundtrips int64 (bigint) data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "int64" });
		let buf = new ArrayBuffer(24);
		new BigInt64Array(buf).set([10n, 20n, 30n]);
		let input = new Uint8Array(buf);
		let decoded = codec.decode(codec.encode(input));
		let result = new BigInt64Array(
			decoded.buffer,
			decoded.byteOffset,
			decoded.byteLength / 8,
		);
		expect(Array.from(result)).toEqual([10n, 20n, 30n]);
	});

	it("roundtrips uint64 (bigint) data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "uint64" });
		let buf = new ArrayBuffer(24);
		new BigUint64Array(buf).set([0n, 9007199254740993n, 18014398509481984n]);
		let input = new Uint8Array(buf);
		let decoded = codec.decode(codec.encode(input));
		let result = new BigUint64Array(
			decoded.buffer,
			decoded.byteOffset,
			decoded.byteLength / 8,
		);
		expect(Array.from(result)).toEqual([
			0n,
			9007199254740993n,
			18014398509481984n,
		]);
	});

	it("handles empty data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
		let input = new Uint8Array(0);
		let encoded = codec.encode(input);
		expect(encoded.length).toBe(0);
	});

	it("throws on unsupported dtype", () => {
		expect(() =>
			DeltaCodec.fromConfig(
				{},
				{
					// @ts-expect-error - invalid dtype
					data_type: "complex64",
				},
			),
		).toThrow("Unknown or unsupported data_type");
	});

	it("throws on unaligned data", () => {
		let codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
		let input = new Uint8Array(5); // not a multiple of 4
		expect(() => codec.encode(input)).toThrow("not a multiple of element size");
	});
});
