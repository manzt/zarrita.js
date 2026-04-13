import type { Chunk, String } from "../metadata.js";
import { getStrides } from "../util.js";
import { unimplementedEncode } from "./_shared.js";

export class VLenUTF8 {
	readonly kind = "array_to_bytes";
	#shape: number[];
	#strides: number[];

	constructor(shape: number[]) {
		this.#shape = shape;
		this.#strides = getStrides(shape, "C");
	}
	static fromConfig(_: unknown, meta: { shape: number[] }) {
		return new VLenUTF8(meta.shape);
	}

	encode = unimplementedEncode("vlen-utf8");

	decode(bytes: Uint8Array): Chunk<String> {
		let decoder = new TextDecoder();
		let view = new DataView(bytes.buffer);
		let data: Array<string> = Array(view.getUint32(0, true));
		let pos = 4;
		for (let i = 0; i < data.length; i++) {
			let itemLength = view.getUint32(pos, true);
			pos += 4;
			data[i] = decoder.decode(
				(bytes.buffer as ArrayBuffer).slice(pos, pos + itemLength),
			);
			pos += itemLength;
		}
		return { data, shape: this.#shape, stride: this.#strides };
	}
}
