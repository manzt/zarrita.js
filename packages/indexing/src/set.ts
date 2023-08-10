import { KeyError } from "@zarrita/core";
import type { Async, Readable, Writeable } from "@zarrita/storage";
import type { Array, Chunk, DataType, Scalar, TypedArray } from "@zarrita/core";

import { create_queue, get_ctr, get_strides } from "./util.js";
import { BasicIndexer, type IndexerProjection } from "./indexer.js";
import type { Indices, Prepare, SetFromChunk, SetOptions, SetScalar, Slice } from "./types.js";

function flip(m: IndexerProjection) {
	if (m.to == null) return { from: m.to, to: m.from };
	return { from: m.to, to: m.from };
}

export async function set<Dtype extends DataType, Arr extends Chunk<Dtype>>(
	arr: Array<Dtype, (Readable & Writeable) | Async<Readable & Writeable>>,
	selection: (number | Slice | null)[] | null,
	value: Scalar<Dtype> | Arr,
	opts: SetOptions,
	setter: {
		prepare: Prepare<Dtype, Arr>;
		set_scalar: SetScalar<Dtype, Arr>;
		set_from_chunk: SetFromChunk<Dtype, Arr>;
	},
) {
	const indexer = new BasicIndexer({
		selection,
		shape: arr.shape,
		chunk_shape: arr.chunk_shape,
	});

	// We iterate over all chunks which overlap the selection and thus contain data
	// that needs to be replaced. Each chunk is processed in turn, extracting the
	// necessary data from the value array and storing into the chunk array.

	const chunk_size = arr.chunk_shape.reduce((a, b) => a * b, 1);
	const queue = opts.create_queue ? opts.create_queue() : create_queue();
	const TypedArrayConstructor = get_ctr(arr.dtype);

	// N.B., it is an important optimisation that we only visit chunks which overlap
	// the selection. This minimises the number of iterations in the main for loop.
	for (const { chunk_coords, mapping } of indexer) {
		const chunk_selection = mapping.map((i) => i.from);
		const flipped = mapping.map(flip);
		queue.add(async () => {
			// obtain key for chunk storage
			const chunk_path = arr.resolve(arr.chunk_key(chunk_coords)).path;

			let cdata: TypedArray<Dtype>;
			const shape = arr.chunk_shape;
			// TODO: We should compute strides for the chunk, not the array
			const stride = get_strides(shape, "C");

			if (is_total_slice(chunk_selection, arr.chunk_shape)) {
				// totally replace
				cdata = new TypedArrayConstructor(chunk_size);
				// optimization: we are completely replacing the chunk, so no need
				// to access the exisiting chunk data
				if (typeof value === "object") {
					// Otherwise data just contiguous TypedArray
					const chunk = setter.prepare(cdata, shape.slice(), stride.slice());
					setter.set_from_chunk(chunk, value, flipped);
				} else {
					// @ts-expect-error
					cdata.fill(value as any);
				}
			} else {
				// partially replace the contents of this chunk
				cdata = await arr.get_chunk(chunk_coords)
					.then(({ data }) => data)
					.catch((err) => {
						if (!(err instanceof KeyError)) throw err;
						const empty = new TypedArrayConstructor(chunk_size);
						// @ts-ignore
						if (arr.fill_value) empty.fill(arr.fill_value);
						return empty;
					});

				const chunk = setter.prepare(cdata, shape.slice(), stride.slice());

				// Modify chunk data
				if (typeof value === "object") {
					setter.set_from_chunk(chunk, value, flipped);
				} else {
					setter.set_scalar(chunk, chunk_selection, value);
				}
			}
			// encode chunk
			const encoded_chunk_data = await arr.codec_pipeline.encode(cdata);
			// store
			await arr.store.set(chunk_path, encoded_chunk_data);
		});
	}
	await queue.onIdle();
}

function is_total_slice(
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
