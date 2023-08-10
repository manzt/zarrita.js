import type { Codec } from "numcodecs";
import type { ArrayMetadata, Chunk, DataType } from "./metadata.js";

import { TransposeCodec } from "./codecs/transpose.js";
import { EndianCodec } from "./codecs/endian.js";

type CodecEntry = {
	fromConfig: (config: Record<string, any>, meta: ArrayMetadata) => Codec;
	kind?: "array_to_array" | "array_to_bytes" | "bytes_to_bytes";
};

function create_default_registry(): Map<
	string,
	() => Promise<CodecEntry>
> {
	return new Map()
		.set("blosc", () => import("numcodecs/blosc").then((m) => m.default))
		.set("gzip", () => import("numcodecs/gzip").then((m) => m.default))
		.set("lz4", () => import("numcodecs/lz4").then((m) => m.default))
		.set("zlib", () => import("numcodecs/zlib").then((m) => m.default))
		.set("zstd", () => import("numcodecs/zstd").then((m) => m.default))
		.set("transpose", () => TransposeCodec)
		.set("endian", () => EndianCodec);
}

export const registry = create_default_registry();

export function create_codec_pipeline(
	array_metadata: ArrayMetadata<DataType>,
	codec_registry: typeof registry = registry,
) {
	let array_to_array: Codec = TransposeCodec.fromConfig(
		{ order: "C" },
		array_metadata,
	);
	let array_to_bytes: Codec = EndianCodec.fromConfig(
		{ endian: "little" },
		array_metadata,
	);
	let bytes_to_bytes: Codec[] = [];
	let initialized = false;
	async function init_codecs() {
		let promises = array_metadata.codecs.map(async (meta) => {
			let Codec = await codec_registry.get(meta.name)?.();
			if (!Codec) {
				throw new Error(`Unknown codec: ${meta.name}`);
			}
			if (Codec.kind === "array_to_array") {
				array_to_array = Codec.fromConfig(meta.configuration, array_metadata);
				return;
			}
			if (Codec.kind === "array_to_bytes") {
				array_to_bytes = Codec.fromConfig(meta.configuration, array_metadata);
				return;
			}
			bytes_to_bytes.push(Codec.fromConfig(meta.configuration, array_metadata));
		});
		await Promise.all(promises);
		initialized = true;
	}
	return {
		async encode<Dtype extends DataType>(
			data: Chunk<Dtype>,
		): Promise<Uint8Array> {
			if (!initialized) await init_codecs();
			data = await array_to_array.encode(data);
			data = await array_to_bytes.encode(data);
			for await (const codec of bytes_to_bytes) {
				data = await codec.encode(data);
			}
			return data as unknown as Uint8Array;
		},
		async decode(bytes: Uint8Array): Promise<Chunk<DataType>> {
			if (!initialized) await init_codecs();
			for (let i = bytes_to_bytes.length - 1; i >= 0; i--) {
				bytes = await bytes_to_bytes[i].decode(bytes);
			}
			bytes = await array_to_bytes.decode(bytes);
			bytes = await array_to_array.decode(bytes);
			return bytes as unknown as Chunk<DataType>;
		},
	};
}
