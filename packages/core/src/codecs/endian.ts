import type { ArrayMetadata, DataType } from "../metadata.js";
import { byteswap_inplace } from "../util.js";

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

export class EndianCodec {
	kind = "array_to_bytes";

	constructor(
		public configuration: { endian: "little" | "big" },
		public array_metadata: ArrayMetadata<DataType>,
	) {}

	static fromConfig(
		configuration: { endian: "little" | "big" },
		array_metadata: ArrayMetadata<DataType>,
	): EndianCodec {
		return new EndianCodec(configuration, array_metadata);
	}

	encode(bytes: Uint8Array): Uint8Array {
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.array_metadata.data_type));
		}
		return bytes;
	}

	decode(bytes: Uint8Array): Uint8Array {
		if (LITTLE_ENDIAN_OS && this.configuration.endian === "big") {
			byteswap_inplace(bytes, bytes_per_element(this.array_metadata.data_type));
		}
		return bytes;
	}
}
