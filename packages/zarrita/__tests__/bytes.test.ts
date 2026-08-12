import { describe, expect, it } from "vitest";
import { BytesCodec } from "../src/codecs/bytes.js";

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
});
