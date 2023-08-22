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

function bytes_per_element(data_type: DataType): number {
	const mapping: any = {
		int8: 1,
		int16: 2,
		int32: 4,
		int64: 8,
		uint8: 1,
		uint16: 2,
		uint32: 4,
		uint64: 8,
		float32: 4,
		float64: 8,
	};
	let b = mapping[data_type] ?? data_type.startsWith("v2:U") ? 4 : undefined;
	if (!b) {
		throw new Error(`Unknown or unsupported data type: ${data_type}`);
	}
	return b;
}

export class EndianCodec<D extends DataType> {
	kind = "array_to_bytes";
	strides: number[];
	TypedArray: TypedArrayConstructor<D>;

	constructor(
		public configuration: { endian: "little" | "big" },
		public data_type: D,
		public shape: number[],
		codecs: CodecMetadata[],
	) {
		this.TypedArray = get_ctr(data_type);
		this.strides = get_strides(shape, get_array_order(codecs));
	}

	static fromConfig<D extends DataType>(
		configuration: { endian: "little" | "big" },
		meta: { data_type: D; shape: number[]; codecs: CodecMetadata[] },
	): EndianCodec<D> {
		return new EndianCodec(
			configuration,
			meta.data_type,
			meta.shape,
			meta.codecs,
		);
	}

	encode(arr: Chunk<D>): Uint8Array {
		let bytes = new Uint8Array(arr.data.buffer);
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.data_type));
		}
		return bytes;
	}

	decode(bytes: Uint8Array): Chunk<D> {
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.data_type));
		}
		return {
			data: new this.TypedArray(bytes.buffer),
			shape: this.shape,
			stride: this.strides,
		};
	}
}
