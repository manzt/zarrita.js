import { describe, expect, it } from "vitest";
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
