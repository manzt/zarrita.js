import type { ArrayMetadata, Chunk, DataType } from "../metadata.js";
import { byteswap_inplace, get_ctr, get_strides } from "../util.js";

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
	let b = mapping[data_type];
	if (!b) {
		throw new Error(`Unknown or unsupported data type: ${data_type}`);
	}
	return b;
}

export class EndianCodec<D extends DataType> {
	kind = "array_to_bytes";

	constructor(
		public configuration: { endian: "little" | "big" },
		public array_metadata: ArrayMetadata<DataType>,
	) {}

	static fromConfig<D extends DataType>(
		configuration: { endian: "little" | "big" },
		array_metadata: ArrayMetadata<D>,
	): EndianCodec<D> {
		return new EndianCodec(configuration, array_metadata);
	}

	encode(arr: Chunk<D>): Uint8Array {
		let bytes = new Uint8Array(arr.data.buffer);
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.array_metadata.data_type));
		}
		return bytes;
	}

	decode(bytes: Uint8Array): Chunk<D> {
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.array_metadata.data_type));
		}
		let ctr = get_ctr(this.array_metadata.data_type);
		let maybe_transpose_codec = this.array_metadata.codecs.find((c) =>
			c.name === "transpose"
		);
		return {
			data: new ctr(bytes.buffer) as any,
			shape: this.array_metadata.chunk_grid.configuration.chunk_shape,
			stride: get_strides(
				this.array_metadata.chunk_grid.configuration.chunk_shape,
				maybe_transpose_codec?.configuration.order === "F" ? "F" : "C",
			),
		};
	}
}
