import type { Readable } from "@zarrita/storage";

import { type Array, get_context } from "../hierarchy.js";
import type { Chunk, DataType, Scalar, TypedArray } from "../metadata.js";
import { BasicIndexer } from "./indexer.js";
import type {
	GetOptions,
	Prepare,
	SetFromChunk,
	SetScalar,
	Slice,
} from "./types.js";
import { create_queue } from "./util.js";

// WeakMap to assign unique IDs to store instances
const storeIdMap = new WeakMap<object, number>();
let storeIdCounter = 0;

function getStoreId(store: any): string {
	if (!storeIdMap.has(store)) {
		storeIdMap.set(store, storeIdCounter++);
	}
	return `store_${storeIdMap.get(store)}`;
}

function createCacheKey(arr: Array<any, any>, chunk_coords: number[]): string {
	let context = get_context(arr);
	let chunkKey = context.encode_chunk_key(chunk_coords);
	let storeId = getStoreId(arr.store);
	return `${storeId}:${arr.path}:${chunkKey}`;
}

function unwrap<D extends DataType>(
	arr: TypedArray<D>,
	idx: number,
): Scalar<D> {
	return ("get" in arr ? arr.get(idx) : arr[idx]) as Scalar<D>;
}

export async function get<
	D extends DataType,
	Store extends Readable,
	Arr extends Chunk<D>,
	Sel extends (null | Slice | number)[],
>(
	arr: Array<D, Store>,
	selection: null | Sel,
	opts: GetOptions<Parameters<Store["get"]>[1]>,
	setter: {
		prepare: Prepare<D, Arr>;
		set_scalar: SetScalar<D, Arr>;
		set_from_chunk: SetFromChunk<D, Arr>;
	},
): Promise<
	null extends Sel[number] ? Arr : Slice extends Sel[number] ? Arr : Scalar<D>
> {
	let context = get_context(arr);
	let indexer = new BasicIndexer({
		selection,
		shape: arr.shape,
		chunk_shape: arr.chunks,
	});

	let out = setter.prepare(
		new context.TypedArray(indexer.shape.reduce((a, b) => a * b, 1)),
		indexer.shape,
		context.get_strides(indexer.shape),
	);

	let queue = opts.create_queue?.() ?? create_queue();
	let cache = opts.cache ?? { get: () => undefined, set: () => {} };
	for (const { chunk_coords, mapping } of indexer) {
		queue.add(async () => {
			let cacheKey = createCacheKey(arr, chunk_coords);
			let cachedChunk = cache.get(cacheKey);
			
			if (cachedChunk) {
				let chunk = setter.prepare(cachedChunk.data as TypedArray<D>, cachedChunk.shape, cachedChunk.stride);
				setter.set_from_chunk(out, chunk, mapping);
			} else {
				let chunkData = await arr.getChunk(chunk_coords, opts.opts);
				cache.set(cacheKey, chunkData);
				let chunk = setter.prepare(chunkData.data, chunkData.shape, chunkData.stride);
				setter.set_from_chunk(out, chunk, mapping);
			}
		});
	}

	await queue.onIdle();

	// If the final out shape is empty, we just return a scalar.
	// @ts-expect-error - TS can't narrow this conditional type
	return indexer.shape.length === 0 ? unwrap(out.data, 0) : out;
}
