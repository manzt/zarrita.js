import type {
	Chunk,
	CodecMetadata,
	DataType,
	TypedArrayConstructor,
} from "../metadata.js";
import {
	byteswap_inplace,
	get_array_order,
	get_ctr,
	get_strides,
} from "../util.js";

const LITTLE_ENDIAN_OS = system_is_little_endian();

function system_is_little_endian(): boolean {
	const a = new Uint32Array([0x12345678]);
	const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
	return !(b[0] === 0x12);
}

function bytes_per_element<D extends DataType>(
	TypedArray: TypedArrayConstructor<D>,
): number {
	if ("BYTES_PER_ELEMENT" in TypedArray) {
		return TypedArray.BYTES_PER_ELEMENT as number;
	}
	// Unicode string array is backed by a Int32Array.
	return 4;
}

export class EndianCodec<D extends DataType> {
	kind = "array_to_bytes";
	#strides: number[];
	#TypedArray: TypedArrayConstructor<D>;
	#BYTES_PER_ELEMENT: number;
	#shape: number[];

	constructor(
		public configuration: { endian: "little" | "big" },
		meta: { data_type: D; shape: number[]; codecs: CodecMetadata[] },
	) {
		this.#TypedArray = get_ctr(meta.data_type);
		this.#shape = meta.shape;
		this.#strides = get_strides(meta.shape, get_array_order(meta.codecs));
		// TODO: fix me.
		// hack to get bytes per element since it's dynamic for string types.
		this.#BYTES_PER_ELEMENT = new this.#TypedArray(0).BYTES_PER_ELEMENT;
	}

	static fromConfig<D extends DataType>(
		configuration: { endian: "little" | "big" },
		meta: { data_type: D; shape: number[]; codecs: CodecMetadata[] },
	): EndianCodec<D> {
		return new EndianCodec(configuration, meta);
	}

	encode(arr: Chunk<D>): Uint8Array {
		let bytes = new Uint8Array(arr.data.buffer);
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.#TypedArray));
		}
		return bytes;
	}

	decode(bytes: Uint8Array): Chunk<D> {
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.#TypedArray));
		}
		return {
			data: new this.#TypedArray(
				bytes.buffer,
				bytes.byteOffset,
				bytes.byteLength / this.#BYTES_PER_ELEMENT,
			),
			shape: this.#shape,
			stride: this.#strides,
		};
	}
}
