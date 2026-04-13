import type { Codec as _Codec } from "numcodecs";
import { BitroundCodec } from "./codecs/bitround.js";
import { CastValueCodec } from "./codecs/cast_value.js";
import { BytesCodec } from "./codecs/bytes.js";
import { Crc32cCodec } from "./codecs/crc32c.js";
import { DeltaCodec } from "./codecs/delta.js";
import { GzipCodec } from "./codecs/gzip.js";
import { JsonCodec } from "./codecs/json2.js";
import { ScaleOffsetCodec } from "./codecs/scale_offset.js";
import { ShuffleCodec } from "./codecs/shuffle.js";
import { TransposeCodec } from "./codecs/transpose.js";
import { VLenUTF8 } from "./codecs/vlen-utf8.js";
import { ZlibCodec } from "./codecs/zlib.js";
import type { Chunk, CodecMetadata, DataType, Scalar } from "./metadata.js";
import { assert } from "./util.js";

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
	);
}

export const registry: Map<string, () => Promise<CodecEntry>> =
	createDefaultRegistry();

export function createCodecPipeline<Dtype extends DataType>(
	chunkMetadata: ChunkMetadata<Dtype>,
): {
	encode(chunk: Chunk<Dtype>): Promise<Uint8Array>;
	decode(bytes: Uint8Array): Promise<Chunk<Dtype>>;
	resolvedFillValue(): Promise<Scalar<Dtype> | null>;
} {
	// Lazily load codecs on first use. The promise is shared by all methods.
	let codecsPromise: ReturnType<typeof loadCodecs<Dtype>> | undefined;
	function getCodecs() {
		if (!codecsPromise) codecsPromise = loadCodecs(chunkMetadata);
		return codecsPromise;
	}
	return {
		// The fill value after propagation through all array-to-array codecs'
		// encode paths. This is the fill value in the type that the
		// array-to-bytes codec sees — i.e. what "empty" looks like on disk.
		// It is NOT the logical fill value the user declared in the array metadata.
		async resolvedFillValue() {
			let c = await getCodecs();
			return c.resolvedFillValue as Scalar<Dtype> | null;
		},
		async encode(chunk: Chunk<Dtype>): Promise<Uint8Array> {
			let codecs = await getCodecs();
			for (const codec of codecs.arrayToArray) {
				chunk = await codec.encode(chunk);
			}
			let bytes = await codecs.arrayToBytes.encode(chunk);
			for (const codec of codecs.bytesToBytes) {
				bytes = await codec.encode(bytes);
			}
			return bytes;
		},
		async decode(bytes: Uint8Array): Promise<Chunk<Dtype>> {
			let codecs = await getCodecs();
			for (let i = codecs.bytesToBytes.length - 1; i >= 0; i--) {
				bytes = await codecs.bytesToBytes[i].decode(bytes);
			}
			let chunk = await codecs.arrayToBytes.decode(bytes);
			for (let i = codecs.arrayToArray.length - 1; i >= 0; i--) {
				chunk = await codecs.arrayToArray[i].decode(chunk);
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

async function loadCodecs<D extends DataType>(chunkMeta: ChunkMetadata<D>) {
	let promises = chunkMeta.codecs.map(async (meta) => {
		let Codec = await registry.get(meta.name)?.();
		assert(Codec, `Unknown codec: ${meta.name}`);
		return { Codec, meta };
	});
	let arrayToArray: ArrayToArrayCodec<D>[] = [];
	let arrayToBytes: ArrayToBytesCodec<D> | undefined;
	let bytesToBytes: BytesToBytesCodec[] = [];
	// Track the "current" data type through the codec chain. Array-to-array
	// codecs like cast_value may change the type, and subsequent codecs
	// (especially bytes) need to see the updated type.
	let currentMeta = { ...chunkMeta };
	for await (let { Codec, meta } of promises) {
		let codec = Codec.fromConfig(meta.configuration, currentMeta);
		switch (codec.kind) {
			case "array_to_array":
				arrayToArray.push(codec as unknown as ArrayToArrayCodec<D>);
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
				arrayToBytes = codec as unknown as ArrayToBytesCodec<D>;
				break;
			default:
				bytesToBytes.push(codec as unknown as BytesToBytesCodec);
		}
	}
	if (!arrayToBytes) {
		assert(
			isTypedArrayLikeMeta(currentMeta),
			`Cannot encode ${currentMeta.dataType} to bytes without a codec`,
		);
		arrayToBytes = BytesCodec.fromConfig({ endian: "little" }, currentMeta);
	}
	return {
		arrayToArray,
		arrayToBytes,
		bytesToBytes,
		resolvedFillValue: currentMeta.fillValue,
	};
}

function isTypedArrayLikeMeta<D extends DataType>(
	meta: ChunkMetadata<D>,
): meta is ChunkMetadata<Exclude<D, "v2:object" | "string">> {
	return meta.dataType !== "v2:object" && meta.dataType !== "string";
}
