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

export function create_codec_pipeline<Dtype extends DataType>(
	array_metadata: ArrayMetadata<Dtype>,
) {
	let codecs: Awaited<ReturnType<typeof load_codecs>>;
	return {
		async encode(chunk: Chunk<Dtype>): Promise<Uint8Array> {
			if (!codecs) codecs = await load_codecs(array_metadata);
			for (const codec of codecs.array_to_array) {
				chunk = await codec.encode(chunk);
			}
			let bytes = await codecs.array_to_bytes.encode(chunk);
			for (const codec of codecs.bytes_to_bytes) {
				bytes = await codec.encode(bytes);
			}
			return bytes;
		},
		async decode(bytes: Uint8Array): Promise<Chunk<Dtype>> {
			if (!codecs) codecs = await load_codecs(array_metadata);
			for (let i = codecs.bytes_to_bytes.length - 1; i >= 0; i--) {
				bytes = await codecs.bytes_to_bytes[i].decode(bytes);
			}
			let chunk = await codecs.array_to_bytes.decode(bytes);
			for (let i = codecs.array_to_array.length - 1; i >= 0; i--) {
				chunk = await codecs.array_to_array[i].decode(chunk);
			}
			return chunk;
		},
	};
}

type ArrayToArrayCodec<D extends DataType> = {
	encode: (data: Chunk<D>) => Promise<Chunk<D>> | Chunk<D>;
	decode: (data: Chunk<D>) => Promise<Chunk<D>> | Chunk<D>;
};

type ArrayToBytesCodec<D extends DataType> = {
	encode: (data: Chunk<D>) => Promise<Uint8Array> | Uint8Array;
	decode: (data: Uint8Array) => Promise<Chunk<D>> | Chunk<D>;
};

type BytesToBytesCodec = {
	encode: (data: Uint8Array) => Promise<Uint8Array>;
	decode: (data: Uint8Array) => Promise<Uint8Array>;
};

async function load_codecs<D extends DataType>(
	array_metadata: ArrayMetadata<D>,
) {
	let promises = array_metadata.codecs.map(async (meta) => {
		let Codec = await registry.get(meta.name)?.();
		if (!Codec) {
			throw new Error(`Unknown codec: ${meta.name}`);
		}
		return { Codec, meta };
	});
	let array_to_array: ArrayToArrayCodec<D>[] = [];
	let array_to_bytes: ArrayToBytesCodec<D> = EndianCodec.fromConfig({
		endian: "little",
	}, array_metadata);
	let bytes_to_bytes: BytesToBytesCodec[] = [];
	for await (let { Codec, meta } of promises) {
		let codec = Codec.fromConfig(meta.configuration, array_metadata);
		switch (codec.kind) {
			case "array_to_array":
				array_to_array.push(codec);
				break;
			case "array_to_bytes":
				array_to_bytes = codec;
				break;
			default:
				bytes_to_bytes.push(codec);
		}
	}
	if (array_to_array.length === 0) {
		array_to_array.push(
			TransposeCodec.fromConfig({ order: "C" }, array_metadata),
		);
	}
	return { array_to_array, array_to_bytes, bytes_to_bytes };
}
