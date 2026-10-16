import { describe, expect, it } from "vitest";
import { BytesCodec } from "../src/codecs/bytes.js";
import type { Struct } from "../src/metadata.js";

let meta = (dataType: "int32") => ({ dataType, shape: [2], codecs: [] });

describe("BytesCodec", () => {
	it("does not mutate the input buffer when byteswapping big-endian", () => {
		let codec = BytesCodec.fromConfig({ endian: "big" }, meta("int32"));
		let bytes = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 2]);
		let original = bytes.slice();

		codec.decode(bytes);

		expect(bytes).toEqual(original);
	});

	it("decodes the same buffer identically on repeated reads", () => {
		let codec = BytesCodec.fromConfig({ endian: "big" }, meta("int32"));
		// A byte cache hands back the same Uint8Array on every hit. See #431.
		let bytes = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 2]);

		let first = Array.from(codec.decode(bytes).data);
		let second = Array.from(codec.decode(bytes).data);
		let third = Array.from(codec.decode(bytes).data);

		expect(first).toEqual([1, 2]);
		expect(second).toEqual(first);
		expect(third).toEqual(first);
	});

	it("does not mutate the source array buffer when encoding big-endian", () => {
		let codec = BytesCodec.fromConfig({ endian: "big" }, meta("int32"));
		let data = new Int32Array([1, 2]);
		let snapshot = data.slice();

		codec.encode({ data, shape: [2], stride: [1] });

		expect(data).toEqual(snapshot);
	});

	it("decodes a view whose byteOffset isn't a multiple of BYTES_PER_ELEMENT", () => {
		// uint64 (BigUint64Array) needs 8-byte alignment. A store can hand back
		// a Uint8Array view into a larger buffer (e.g. a shard's suffix bytes)
		// whose byteOffset doesn't land on an 8-byte boundary; the TypedArray
		// constructor throws `RangeError: start offset ... should be a multiple
		// of 8` unless we copy into a fresh, aligned buffer first.
		let codec = BytesCodec.fromConfig(
			{ endian: "little" },
			{ dataType: "uint64" as const, shape: [2], codecs: [] },
		);
		let backing = new Uint8Array(17);
		backing.set([1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0], 1);
		let bytes = backing.subarray(1, 17);
		expect(bytes.byteOffset).toBe(1);

		let chunk = codec.decode(bytes);

		expect(Array.from(chunk.data)).toEqual([1n, 2n]);
	});

	describe("struct", () => {
		let dataType: Struct = {
			name: "struct",
			configuration: {
				fields: [
					{ name: "id", data_type: "int16" },
					{ name: "flag", data_type: "bool" },
					{ name: "value", data_type: "float32" },
				],
			},
		};
		let structMeta = { dataType, shape: [2], codecs: [] };
		// Two records of 7 bytes: (1, true, 1.5) and (-2, false, -0.25)
		let little = [1, 0, 1, 0, 0, 0xc0, 0x3f, 0xfe, 0xff, 0, 0, 0, 0x80, 0xbe];
		let big = [0, 1, 1, 0x3f, 0xc0, 0, 0, 0xff, 0xfe, 0, 0xbe, 0x80, 0, 0];
		let records = [
			{ id: 1, flag: true, value: 1.5 },
			{ id: -2, flag: false, value: -0.25 },
		];

		it.each([
			["little", little],
			["big", big],
		] as const)("decodes and encodes %s-endian records", (endian, stored) => {
			let codec = BytesCodec.fromConfig({ endian }, structMeta);
			let bytes = new Uint8Array(stored);
			let chunk = codec.decode(bytes);
			expect(Array.from(chunk.data)).toStrictEqual(records);
			expect(chunk.shape).toStrictEqual([2]);
			// Decoding leaves the stored bytes as they were.
			expect(Array.from(bytes)).toStrictEqual(stored);
			expect(Array.from(codec.encode(chunk))).toStrictEqual(stored);
		});

		it("reads records that start at any byte offset", () => {
			let codec = BytesCodec.fromConfig({ endian: "little" }, structMeta);
			let padded = new Uint8Array([9, 9, 9, ...little]);
			let chunk = codec.decode(padded.subarray(3));
			expect(Array.from(chunk.data)).toStrictEqual(records);
			// The bytes are viewed where they are, without a copy.
			expect(chunk.data.buffer).toBe(padded.buffer);
		});
	});
});
