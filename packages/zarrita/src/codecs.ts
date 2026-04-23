import type { Codec as _Codec } from "numcodecs";
import { BitroundCodec } from "./codecs/bitround.js";
import { BytesCodec } from "./codecs/bytes.js";
import { CastValueCodec } from "./codecs/cast_value.js";
import { Crc32cCodec } from "./codecs/crc32c.js";
import { DeltaCodec } from "./codecs/delta.js";
import { GzipCodec } from "./codecs/gzip.js";
import { JsonCodec } from "./codecs/json2.js";
import { ScaleOffsetCodec } from "./codecs/scale_offset.js";
import { ShuffleCodec } from "./codecs/shuffle.js";
import { TransposeCodec } from "./codecs/transpose.js";
import { VLenUTF8 } from "./codecs/vlen-utf8.js";
import { ZlibCodec } from "./codecs/zlib.js";
import {
	CodecPipelineError,
	InvalidMetadataError,
	UnknownCodecError,
} from "./errors.js";
import type { Chunk, CodecMetadata, DataType, Scalar } from "./metadata.js";

type ChunkMetadata<D extends DataType> = {
	dataType: D;
	shape: number[];
	codecs: CodecMetadata[];
	fillValue: Scalar<D> | null;
};

type CodecEntry = {
	fromConfig: (config: unknown, meta: ChunkMetadata<DataType>) => Codec;
	kind?: "array_to_array" | "array_to_bytes" | "bytes_to_bytes";
};

type Codec = _Codec & {
	kind: CodecEntry["kind"];
	// Array-to-array codecs that change the data type (e.g. cast_value) must
	// implement this to describe the metadata after encoding. The pipeline
	// calls it so that subsequent codecs (especially bytes) see the correct type.
	getEncodedMeta?: (meta: ChunkMetadata<DataType>) => ChunkMetadata<DataType>;
};

function createDefaultRegistry(): Map<string, () => Promise<CodecEntry>> {
	let blosc = () => import("numcodecs/blosc").then((m) => m.default);
	let lz4 = () => import("numcodecs/lz4").then((m) => m.default);
	let zstd = () => import("numcodecs/zstd").then((m) => m.default);
	let gzip = () => GzipCodec;
	let zlib = () => ZlibCodec;
	return (
		new Map()
			// v3 codecs
			.set("blosc", blosc)
			.set("lz4", lz4)
			.set("zstd", zstd)
			.set("gzip", gzip)
			.set("zlib", zlib)
			.set("transpose", () => TransposeCodec)
			.set("bytes", () => BytesCodec)
			.set("crc32c", () => Crc32cCodec)
			.set("vlen-utf8", () => VLenUTF8)
			.set("json2", () => JsonCodec)
			.set("bitround", () => BitroundCodec)
			.set("cast_value", () => CastValueCodec)
			.set("scale_offset", () => ScaleOffsetCodec)
			// numcodecs (v2 compat)
			.set("numcodecs.blosc", blosc)
			.set("numcodecs.lz4", lz4)
			.set("numcodecs.zstd", zstd)
			.set("numcodecs.gzip", gzip)
			.set("numcodecs.zlib", zlib)
			.set("numcodecs.vlen-utf8", () => VLenUTF8)
			.set("numcodecs.shuffle", () => ShuffleCodec)
			.set("numcodecs.delta", () => DeltaCodec)
			.set("numcodecs.bitround", () => BitroundCodec)
			.set("numcodecs.json2", () => JsonCodec)
	);
}

export const registry: Map<string, () => Promise<CodecEntry>> =
	createDefaultRegistry();

export function createCodecPipeline<Dtype extends DataType>(
	chunkMetadata: ChunkMetadata<Dtype>,
): {
	encode(chunk: Chunk<Dtype>): Promise<Uint8Array>;
	decode(bytes: Uint8Array): Promise<Chunk<Dtype>>;
} {
	// Lazily load codecs on first use. The promise is shared by all methods.
	let codecsPromise: ReturnType<typeof loadCodecs<Dtype>> | undefined;
	function getCodecs() {
		if (!codecsPromise) codecsPromise = loadCodecs(chunkMetadata);
		return codecsPromise;
	}
	async function runStep<T>(
		direction: "encode" | "decode",
		codec: string,
		fn: () => Promise<T> | T,
	): Promise<T> {
		try {
			return await fn();
		} catch (cause) {
			throw new CodecPipelineError({ direction, codec, cause });
		}
	}
	return {
		async encode(chunk: Chunk<Dtype>): Promise<Uint8Array> {
			let codecs = await getCodecs();
			for (const { name, codec } of codecs.arrayToArray) {
				chunk = await runStep("encode", name, () => codec.encode(chunk));
			}
			let bytes = await runStep("encode", codecs.arrayToBytes.name, () =>
				codecs.arrayToBytes.codec.encode(chunk),
			);
			for (const { name, codec } of codecs.bytesToBytes) {
				bytes = await runStep("encode", name, () => codec.encode(bytes));
			}
			return bytes;
		},
		async decode(bytes: Uint8Array): Promise<Chunk<Dtype>> {
			let codecs = await getCodecs();
			for (let i = codecs.bytesToBytes.length - 1; i >= 0; i--) {
				const { name, codec } = codecs.bytesToBytes[i];
				bytes = await runStep("decode", name, () => codec.decode(bytes));
			}
			let chunk = await runStep("decode", codecs.arrayToBytes.name, () =>
				codecs.arrayToBytes.codec.decode(bytes),
			);
			for (let i = codecs.arrayToArray.length - 1; i >= 0; i--) {
				const { name, codec } = codecs.arrayToArray[i];
				chunk = await runStep("decode", name, () => codec.decode(chunk));
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

type Named<T> = { name: string; codec: T };

async function loadCodecs<D extends DataType>(chunkMeta: ChunkMetadata<D>) {
	let promises = chunkMeta.codecs.map(async (meta) => {
		let Codec = await registry.get(meta.name)?.();
		if (!Codec) {
			throw new UnknownCodecError(meta.name);
		}
		return { Codec, meta };
	});
	let arrayToArray: Named<ArrayToArrayCodec<D>>[] = [];
	let arrayToBytes: Named<ArrayToBytesCodec<D>> | undefined;
	let bytesToBytes: Named<BytesToBytesCodec>[] = [];
	// Track the "current" data type through the codec chain. Array-to-array
	// codecs like cast_value may change the type, and subsequent codecs
	// (especially bytes) need to see the updated type.
	let currentMeta = { ...chunkMeta };
	for await (let { Codec, meta } of promises) {
		let codec = Codec.fromConfig(meta.configuration, currentMeta);
		switch (codec.kind) {
			case "array_to_array":
				arrayToArray.push({
					name: meta.name,
					codec: codec as unknown as ArrayToArrayCodec<D>,
				});
				// Array-to-array codecs like cast_value may change the data type
				// (and derived metadata like fill_value) between the array's
				// declared type and what's stored on disk. We call getEncodedMeta
				// so that subsequent codecs in the chain — especially the bytes
				// codec — see the correct on-disk type and fill value.
				if (codec.getEncodedMeta) {
					currentMeta = codec.getEncodedMeta(currentMeta) as ChunkMetadata<D>;
				}
				break;
			case "array_to_bytes":
				arrayToBytes = {
					name: meta.name,
					codec: codec as unknown as ArrayToBytesCodec<D>,
				};
				break;
			default:
				bytesToBytes.push({
					name: meta.name,
					codec: codec as unknown as BytesToBytesCodec,
				});
		}
	}
	if (!arrayToBytes) {
		if (!isTypedArrayLikeMeta(currentMeta)) {
			throw new InvalidMetadataError(
				`Cannot encode ${currentMeta.dataType} to bytes without a codec`,
			);
		}
		arrayToBytes = {
			name: "bytes",
			codec: BytesCodec.fromConfig(
				{ endian: "little" },
				currentMeta,
			) as unknown as ArrayToBytesCodec<D>,
		};
	}
	return {
		arrayToArray,
		arrayToBytes,
		bytesToBytes,
	};
}

function isTypedArrayLikeMeta<D extends DataType>(
	meta: ChunkMetadata<D>,
): meta is ChunkMetadata<Exclude<D, "v2:object" | "string">> {
	return meta.dataType !== "v2:object" && meta.dataType !== "string";
}
