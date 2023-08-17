import type { Async, Readable } from "@zarrita/storage";
import type { Array, Chunk, DataType, Scalar, TypedArray } from "@zarrita/core";
import type {
	GetOptions,
	Prepare,
	SetFromChunk,
	SetScalar,
	Slice,
} from "./types.js";

import { _internal_get_array_context, KeyError } from "@zarrita/core";
import { BasicIndexer } from "./indexer.js";
import { create_queue } from "./util.js";

function unwrap<D extends DataType>(
	arr: TypedArray<D>,
	idx: number,
): Scalar<D> {
	return "get" in arr ? arr.get(idx) : arr[idx] as any;
}

export async function get<
	D extends DataType,
	Store extends Readable | Async<Readable>,
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
	const context = _internal_get_array_context(arr);
	const indexer = new BasicIndexer({
		selection,
		shape: arr.shape,
		chunk_shape: arr.chunks,
	});
	const out = setter.prepare(
		new context.TypedArray(indexer.shape.reduce((a, b) => a * b, 1)),
		indexer.shape,
		context.get_strides(indexer.shape, opts.order),
	);

	const queue = opts.create_queue?.() ?? create_queue();
	for (const { chunk_coords, mapping } of indexer) {
		queue.add(() =>
			arr.getChunk(chunk_coords, opts.opts)
				.then(({ data, shape, stride }) => {
					const chunk = setter.prepare(data, shape, stride);
					setter.set_from_chunk(out, chunk, mapping);
				})
				.catch((err) => {
					// re-throw error if not a missing chunk
					if (!(err instanceof KeyError)) throw err;
					// KeyError, we need to fill the corresponding array
					if (context.fill_value) {
						setter.set_scalar(
							out,
							mapping
								.map((m) => m.to)
								.filter((s): s is Exclude<typeof s, null> => s !== null),
							context.fill_value,
						);
					}
				})
		);
	}

	await queue.onIdle();

	// If the final out shape is empty, we just return a scalar.
	return indexer.shape.length === 0 ? unwrap(out.data, 0) : out as any;
}
