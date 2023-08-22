import type { Location } from "../hierarchy.js";
import type { Chunk } from "../metadata.js";
import type { ShardingCodecMetadata } from "../util.js";

import { create_codec_pipeline } from "../codecs.js";
import type { Readable } from "@zarrita/storage";
import { KeyError } from "../errors.js";

const MAX_BIG_UINT = 18446744073709551615n;

export function create_sharded_chunk_getter<Store extends Readable>(
	location: Location<Store>,
	shard_shape: number[],
	encode_shard_key: (coord: number[]) => string,
	sharding_config: ShardingCodecMetadata["configuration"],
) {
	if (location.store.getRange === undefined) {
		throw new Error("Store does not support range requests");
	}
	let get_range = location.store.getRange.bind(location.store);
	let index_shape = shard_shape.map((d, i) =>
		d / sharding_config.chunk_shape[i]
	);
	let index_codec = create_codec_pipeline({
		data_type: "uint64",
		shape: [...index_shape, 2],
		codecs: sharding_config.index_codecs,
	});

	let cache: Record<string, Chunk<"uint64">> = {};
	return async (chunk_coord: number[]) => {
		let shard_coord = chunk_coord.map((d, i) => Math.floor(d / index_shape[i]));
		let shard_path = location.resolve(encode_shard_key(shard_coord)).path;

		let index: Chunk<"uint64">;
		if (shard_path in cache) {
			index = cache[shard_path];
		} else {
			let checksum_size = 4;
			let index_size = 16 * index_shape.reduce((a, b) => a * b, 1);
			let bytes = await get_range(shard_path, {
				suffixLength: index_size + checksum_size,
			});
			if (!bytes) {
				throw new Error("Index not found");
			}
			index = cache[shard_path] = await index_codec.decode(bytes);
		}

		let linear_offset = 2 * chunk_coord
			.map((d, i) => d % index.shape[i])
			.reduce((acc, sel, idx) => acc + sel * index.stride[idx], 0);

		let offset = index.data[linear_offset];
		let length = index.data[linear_offset + 1];
		// write null chunk when 2^64-1 indicates fill value
		if (offset === MAX_BIG_UINT && length === MAX_BIG_UINT) {
			throw new KeyError(
				`shard: ${shard_path} chunk: ${chunk_coord.join("/")}}`,
			);
		}
		let maybe_bytes = await get_range(shard_path, {
			offset: Number(offset),
			length: Number(length),
		});
		if (!maybe_bytes) {
			throw new KeyError(
				`shard: ${shard_path} chunk: ${chunk_coord.join("/")}}`,
			);
		}
		return maybe_bytes;
	};
}
