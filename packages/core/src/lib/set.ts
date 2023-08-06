import { KeyError } from "./errors.js";
import { create_queue, encode_chunk, get_strides } from "./util.js";
import { BasicIndexer, type IndexerProjection } from "./indexing.js";
import type { Array } from "./hierarchy.js";

import type {
	Chunk,
	DataType,
	Indices,
	Prepare,
	Scalar,
	SetFromChunk,
	SetOptions,
	SetScalar,
	Slice,
	TypedArray,
} from "../types.js";

import type { Async, Readable, Writeable } from "@zarrita/storage";

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

	// N.B., it is an important optimisation that we only visit chunks which overlap
	// the selection. This minimises the number of iterations in the main for loop.
	for (const { chunk_coords, mapping } of indexer) {
		const chunk_selection = mapping.map((i) => i.from);
		const flipped = mapping.map(flip);
		queue.add(async () => {
			// obtain key for chunk storage
			// @ts-ignore TODO: make chunk_key unprotected?
			const chunk_key = arr.chunk_key(chunk_coords);

			let cdata: TypedArray<Dtype>;
			const shape = arr.chunk_shape;
			const stride = get_strides(shape, arr.order);

			if (is_total_slice(chunk_selection, arr.chunk_shape)) {
				// totally replace
				cdata = new arr.TypedArray(chunk_size);
				// optimization: we are completely replacing the chunk, so no need
				// to access the exisiting chunk data
				if (typeof value === "object") {
					// Otherwise data just contiguous TypedArray
					const chunk = setter.prepare(cdata, shape.slice(), stride.slice());
					setter.set_from_chunk(chunk, value, flipped);
				} else {
					// @ts-ignore
					cdata.fill(value as any);
				}
			} else {
				// partially replace the contents of this chunk
				cdata = await arr.get_chunk(chunk_coords)
					.then(({ data }) => data)
					.catch((err) => {
						if (!(err instanceof KeyError)) throw err;
						const empty = new arr.TypedArray(chunk_size);
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
			const encoded_chunk_data = await encode_chunk(arr, cdata);
			// store
			await arr.store.set(chunk_key, encoded_chunk_data);
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
