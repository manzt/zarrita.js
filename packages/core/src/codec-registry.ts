import type { Codec } from "numcodecs";
import type { ArrayMetadata, Chunk, DataType, TypedArray } from "./types.js";
import { get_ctr, get_strides } from "./util.js";

type Config = Record<string, any>;
type CodecImporter = () => Promise<{ fromConfig: (config: Config) => Codec }>;

function system_is_little_endian(): boolean {
	const a = new Uint32Array([0x12345678]);
	const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
	return !(b[0] === 0x12);
}

const LITTLE_ENDIAN_OS = system_is_little_endian();
function byteswap_inplace(view: Uint8Array, bytes_per_element: number) {
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

function create_default_registry(): Map<string, CodecImporter> {
	return new Map()
		.set("blosc", () => import("numcodecs/blosc").then((m) => m.default))
		.set("gzip", () => import("numcodecs/gzip").then((m) => m.default))
		.set("lz4", () => import("numcodecs/lz4").then((m) => m.default))
		.set("zlib", () => import("numcodecs/zlib").then((m) => m.default))
		.set("zstd", () => import("numcodecs/zstd").then((m) => m.default))
		.set("endian", () => EndianCodec);
}

export const registry = create_default_registry();

export type CodecPipeline = ReturnType<typeof create_codec_pipeline>;

export function create_codec_pipeline(
	array_metadata: ArrayMetadata<DataType>,
	codec_registry: typeof registry = registry,
) {
	let codecs: Promise<Codec>[] | undefined;

	function init() {
		let metadata = array_metadata.codecs;
		return metadata.map(async (meta) => {
			let Codec = await codec_registry.get(meta.name)?.();
			if (!Codec) {
				throw new Error(`Unknown codec: ${meta.name}`);
			}
			// @ts-expect-error
			return Codec.fromConfig(meta.configuration, array_metadata);
		});
	}
	return {
		async encode<Dtype extends DataType>(
			data: TypedArray<Dtype>,
		): Promise<Uint8Array> {
			if (!codecs) codecs = init();
			let bytes = new Uint8Array(data.buffer);
			for await (const codec of codecs) {
				bytes = await codec.encode(bytes);
			}
			return bytes as unknown as Uint8Array;
		},
		async decode(bytes: Uint8Array): Promise<Chunk<DataType>> {
			if (!codecs) codecs = init();
			for (let i = codecs.length - 1; i >= 0; i--) {
				let codec = await codecs[i];
				bytes = await codec.decode(bytes);
			}
			let ctr = get_ctr(array_metadata.data_type);
			return {
				data: new ctr(bytes.buffer),
				shape: array_metadata.chunk_grid.configuration.chunk_shape,
				stride: get_strides(
					array_metadata.chunk_grid.configuration.chunk_shape,
					"C",
				),
			};
		},
	};
}
