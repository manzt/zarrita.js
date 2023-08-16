import { TransposeCodec } from "./codecs/transpose.js";
import { EndianCodec } from "./codecs/endian.js";

/** @typedef {import("numcodecs").Codec} Codec */
/** @typedef {import("./types.js").DataType} DataType */
/** @typedef {import("./types.js").ArrayMetadata} ArrayMetadata */
/**
 * @template {DataType} D
 * @typedef {import("./types.js").Chunk<D>} Chunk
 */
/**
 * @typedef {{
 *   fromConfig(config: Record<string, any>, meta: ArrayMetadata): Codec;
 *   kind?: "array_to_array" | "array_to_bytes" | "bytes_to_bytes";
 * }} CodecEntry
 */

/** @returns {Map<string, () => Promise<CodecEntry>>} */
function create_default_registry() {
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

/**
 * @template {import("./types.js").DataType} Dtype
 * @param {import("./types.js").ArrayMetadata<Dtype>} array_metadata
 */
export function create_codec_pipeline(array_metadata) {
	/** @type {Awaited<ReturnType<typeof load_codecs>>} */
	let codecs;
	return {
		/**
		 * @param {import("./types.js").Chunk<Dtype>} chunk
		 * @returns {Promise<Uint8Array>}
		 */
		async encode(chunk) {
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
		/**
		 * @param {Uint8Array} bytes
		 * @returns {Promise<import("./types.js").Chunk<Dtype>>}
		 */
		async decode(bytes) {
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

/**
 * @template {DataType} D
 * @typedef {{
 *   encode(data: Chunk<D>): Promise<Chunk<D>> | Chunk<D>;
 *   decode(data: Chunk<D>): Promise<Chunk<D>> | Chunk<D>;
 * }} ArrayToArrayCodec
 */
/**
 * @template {DataType} D
 * @typedef {{
 *   encode(data: Chunk<D>): Promise<Uint8Array> | Uint8Array;
 *   decode(data: Uint8Array): Promise<Chunk<D>> | Chunk<D>;
 * }} ArrayToBytesCodec
 */
/**
 * @typedef {{
 *   encode(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
 *   decode(data: Uint8Array): Promise<Uint8Array> | Uint8Array;
 * }} BytesToBytesCodec
 */

/**
 * @template {DataType} D
 * @param {import("./types.js").ArrayMetadata<D>} array_metadata
 */
async function load_codecs(array_metadata) {
	let promises = array_metadata.codecs.map(async (meta) => {
		let Codec = await registry.get(meta.name)?.();
		if (!Codec) {
			throw new Error(`Unknown codec: ${meta.name}`);
		}
		return { Codec, meta };
	});
	/** @type {ArrayToArrayCodec<D>[]} */
	let array_to_array = [];
	/** @type {ArrayToBytesCodec<D>} */
	let array_to_bytes = EndianCodec.fromConfig(
		{ endian: "little" },
		array_metadata,
	);
	/** @type {BytesToBytesCodec[]} */
	let bytes_to_bytes = [];
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
