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
});
