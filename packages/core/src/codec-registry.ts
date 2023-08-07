import { BoolArray } from "@zarrita/typedarray";
import type { Codec } from "numcodecs";

import type { DataType, TypedArray, TypedArrayConstructor, ArrayMetadata, Chunk } from "./types.js";
import { get_strides } from "./util.js";

type Config = Record<string, any>;
type CodecImporter = () => Promise<{ fromConfig: (config: Config) => Codec }>;

function system_is_little_endian(): boolean {
	const a = new Uint32Array([0x12345678]);
	const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
	return !(b[0] === 0x12);
}

export const LITTLE_ENDIAN_OS = system_is_little_endian();

export function byteswap_inplace(view: Uint8Array, bytes_per_element: number) {
	const numFlips = bytes_per_element / 2;
	const endByteIndex = bytes_per_element - 1;
	let t = 0;
	for (let i = 0; i < view.length; i += bytes_per_element) {
		for (let j = 0; j < numFlips; j += 1) {
			newFunction(i, j);
			view[i + j] = view[i + endByteIndex - j];
			view[i + endByteIndex - j] = t;
		}
	}

	function newFunction(i: number, j: number) {
		t = view[i + j];
	}
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
	if (!b) throw new Error(`Unknown data type: ${data_type}`);
	return b;
}

class EndianCodec {
	constructor(
		public configuration: { endian: "little" | "big" },
		public array_metadata: ArrayMetadata<DataType>,
	) {}

	static fromConfig(
		configuration: { endian: "little" | "big"; bytes_per_element: number },
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

function get_ctr<D extends DataType>(
	data_type: D,
): TypedArrayConstructor<DataType> {
	let mapping: any = {
		int8: Int8Array,
		int16: Int16Array,
		int32: Int32Array,
		int64: BigInt64Array,
		uint8: Uint8Array,
		uint16: Uint16Array,
		uint32: Uint32Array,
		uint64: BigUint64Array,
		float32: Float32Array,
		float64: Float64Array,
		bool: BoolArray,
	};
	let ctr = mapping[data_type];
	if (!ctr) throw new Error(`Unsupported \`data_type\`: ${data_type}`);
	return ctr;
}

class TransposeCodec {
	constructor(
		public configuration: { order: "C" | "F" },
		public array_metadata: ArrayMetadata<DataType>,
	) {}

	fromConfig(
		config: { order: "C" | "F" },
		array_metadata: ArrayMetadata<DataType>,
	): TransposeCodec {
		return new TransposeCodec(config, array_metadata);
	}

	decode(bytes: Uint8Array): Chunk<DataType> {
		let ctr = get_ctr(this.array_metadata.data_type);
		return {
			data: new ctr(bytes) as TypedArray<DataType>,
			shape: this.array_metadata.shape,
			stride: get_strides(this.array_metadata.shape, this.configuration.order),
		};
	}

	encode(chunk: Chunk<DataType>): Uint8Array {
		return chunk.data as Uint8Array;
	}
}

function create_default_registry(): Map<string, CodecImporter> {
	return new Map()
		.set("blosc", () => import("numcodecs/blosc").then((m) => m.default))
		.set("gzip", () => import("numcodecs/gzip").then((m) => m.default))
		.set("lz4", () => import("numcodecs/lz4").then((m) => m.default))
		.set("zlib", () => import("numcodecs/zlib").then((m) => m.default))
		.set("zstd", () => import("numcodecs/zstd").then((m) => m.default))
		.set("endian", () => EndianCodec)
		.set("transpose", () => TransposeCodec);
}

export const registry = create_default_registry();
