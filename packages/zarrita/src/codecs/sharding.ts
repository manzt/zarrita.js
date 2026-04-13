import type { GetOptions, Readable } from "@zarrita/storage";
import { createCodecPipeline } from "../codecs.js";
import { UnsupportedError } from "../errors.js";
import type { Location } from "../hierarchy.js";
import type { Chunk } from "../metadata.js";
import type { ShardingCodecMetadata } from "../util.js";

const MAX_BIG_UINT = 18446744073709551615n;

export function createShardedChunkGetter(
	location: Location<Readable>,
	shardShape: number[],
	encodeShardKey: (coord: number[]) => string,
	shardingConfig: ShardingCodecMetadata["configuration"],
) {
	if (!location.store.getRange) {
		throw new UnsupportedError("sharding requires a store with getRange");
	}
	let getRange = location.store.getRange.bind(location.store);
	let indexShape = shardShape.map((d, i) => d / shardingConfig.chunk_shape[i]);
	let indexCodec = createCodecPipeline({
		dataType: "uint64",
		shape: [...indexShape, 2],
		codecs: shardingConfig.index_codecs,
		fillValue: null,
	});

	let checksumSize = 4;
	let indexSize = 16 * indexShape.reduce((a, b) => a * b, 1);
	let cache: Record<string, Promise<Chunk<"uint64"> | null>> = {};
	return async (chunkCoord: number[], options?: GetOptions) => {
		let shardCoord = chunkCoord.map((d, i) => Math.floor(d / indexShape[i]));
		let shardPath = location.resolve(encodeShardKey(shardCoord)).path;

		if (!(shardPath in cache)) {
			cache[shardPath] = (async () => {
				let bytes = await getRange(
					shardPath,
					{
						suffixLength: indexSize + checksumSize,
					},
					options,
				);
				return bytes ? await indexCodec.decode(bytes) : null;
			})().catch((err) => {
				delete cache[shardPath];
				throw err;
			});
		}
		let index = await cache[shardPath];

		if (index === null) {
			return undefined;
		}

		let { data, shape, stride } = index;
		let linearOffset = chunkCoord
			.map((d, i) => d % shape[i])
			.reduce((acc, sel, idx) => acc + sel * stride[idx], 0);

		let offset = data[linearOffset];
		let length = data[linearOffset + 1];
		// write null chunk when 2^64-1 indicates fill value
		if (offset === MAX_BIG_UINT && length === MAX_BIG_UINT) {
			return undefined;
		}
		return getRange(
			shardPath,
			{
				offset: Number(offset),
				length: Number(length),
			},
			options,
		);
	};
}
