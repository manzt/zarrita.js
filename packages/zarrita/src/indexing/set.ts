import type { Mutable } from "@zarrita/storage";

import { type Array, getContext } from "../hierarchy.js";
import type { Chunk, DataType, Scalar, TypedArray } from "../metadata.js";
import { isAbortable } from "../util.js";
import { BasicIndexer, type IndexerProjection } from "./indexer.js";
import type {
	Indices,
	Prepare,
	SetFromChunk,
	SetOptions,
	SetScalar,
	Slice,
} from "./types.js";
import { createQueue } from "./util.js";

function flipIndexerProjection(m: IndexerProjection) {
	if (m.to == null) return { from: m.to, to: m.from };
	return { from: m.to, to: m.from };
}

export async function set<Dtype extends DataType, Arr extends Chunk<Dtype>>(
	arr: Array<Dtype, Mutable>,
	selection: (number | Slice | null)[] | null,
	value: Scalar<Dtype> | Arr,
	opts: SetOptions,
	setter: {
		prepare: Prepare<Dtype, Arr>;
		setScalar: SetScalar<Dtype, Arr>;
		setFromChunk: SetFromChunk<Dtype, Arr>;
	},
) {
	const context = getContext(arr);
	if (context.kind === "sharded") {
		throw new Error("Set not supported for sharded arrays.");
	}
	const indexer = new BasicIndexer({
		selection,
		shape: arr.shape,
		chunkShape: arr.chunks,
	});

	// Handle scalar arrays (shape=[]) directly, since the indexer yields nothing
	// for zero-dimensional arrays.
	if (arr.shape.length === 0) {
		const chunkData = new context.TypedArray(1);
		if (typeof value === "object") {
			throw new Error("Cannot set a scalar array with a non-scalar value.");
		}
		// @ts-expect-error - Value is a scalar
		chunkData.fill(value);
		const chunkPath = arr.resolve(context.encodeChunkKey([])).path;
		await arr.store.set(
			chunkPath,
			await context.codec.encode({
				data: chunkData,
				shape: [],
				stride: [],
			}),
		);
		return;
	}

	// We iterate over all chunks which overlap the selection and thus contain data
	// that needs to be replaced. Each chunk is processed in turn, extracting the
	// necessary data from the value array and storing into the chunk array.

	const chunkSize = arr.chunks.reduce((a, b) => a * b, 1);
	const queue = opts.createQueue ? opts.createQueue() : createQueue();

	// N.B., it is an important optimisation that we only visit chunks which overlap
	// the selection. This minimises the number of iterations in the main for loop.
	for (const { chunkCoords, mapping } of indexer) {
		const chunkSelection = mapping.map((i) => i.from);
		const flipped = mapping.map(flipIndexerProjection);
		queue.add(async () => {
			if (isAbortable(opts.opts)) {
				opts.opts.signal.throwIfAborted();
			}

			// obtain key for chunk storage
			const chunkPath = arr.resolve(context.encodeChunkKey(chunkCoords)).path;

			let chunkData: TypedArray<Dtype>;
			const chunkShape = arr.chunks.slice();
			const chunkStride = context.getStrides(chunkShape);

			if (isTotalSlice(chunkSelection, chunkShape)) {
				// totally replace
				chunkData = new context.TypedArray(chunkSize);
				// optimization: we are completely replacing the chunk, so no need
				// to access the exisiting chunk data
				if (typeof value === "object") {
					// Otherwise data just contiguous TypedArray
					const chunk = setter.prepare(
						chunkData,
						chunkShape.slice(),
						chunkStride.slice(),
					);
					// @ts-expect-error - Value is not a scalar
					setter.setFromChunk(chunk, value, flipped);
				} else {
					// @ts-expect-error - Value is a scalar
					chunkData.fill(value);
				}
			} else {
				// partially replace the contents of this chunk
				chunkData = await arr.getChunk(chunkCoords).then(({ data }) => data);

				const chunk = setter.prepare(
					chunkData,
					chunkShape.slice(),
					chunkStride.slice(),
				);

				// Modify chunk data
				if (typeof value === "object") {
					// @ts-expect-error - Value is not a scalar
					setter.setFromChunk(chunk, value, flipped);
				} else {
					setter.setScalar(chunk, chunkSelection, value);
				}
			}
			await arr.store.set(
				chunkPath,
				await context.codec.encode({
					data: chunkData,
					shape: chunkShape,
					stride: chunkStride,
				}),
			);
		});
	}
	await queue.onIdle();
}

function isTotalSlice(
	selection: (number | Indices)[],
	shape: readonly number[],
): selection is Indices[] {
	// all items are Indices and every slice is complete
	return selection.every((s, i) => {
		// can't be a full selection
		if (typeof s === "number") return false;
		// explicit complete slice
		const [start, stop, step] = s;
		return stop - start === shape[i] && step === 1;
	});
}
