import { KeyError } from "./errors";
import { BasicIndexer } from "./indexing";
import { create_queue, get_strides } from "./util";
import type { Array } from "./hierarchy";
import type {
	Async,
	Chunk,
	DataType,
	GetOptions,
	Prepare,
	Readable,
	Scalar,
	SetFromChunk,
	SetScalar,
	Slice,
	TypedArray,
} from "../types";

const unwrap = <D extends DataType>(
	arr: TypedArray<D>,
	idx: number,
): Scalar<D> => {
	return "get" in arr ? arr.get(idx) : arr[idx] as any;
};

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
): Promise<null extends Sel[number] ? Arr : Slice extends Sel[number] ? Arr : Scalar<D>> {
	const indexer = new BasicIndexer({
		selection,
		shape: arr.shape,
		chunk_shape: arr.chunk_shape,
	});
	// Setup output array
	const out = setter.prepare(
		new arr.TypedArray(indexer.shape.reduce((a, b) => a * b, 1)),
		indexer.shape,
		get_strides(indexer.shape, opts.order ?? arr.order),
	);
	const queue = opts.create_queue ? opts.create_queue() : create_queue();

	// iterator over chunks
	for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
		queue.add(() =>
			arr.get_chunk(chunk_coords, opts.opts)
				.then(({ data, shape, stride }) => {
					const chunk = setter.prepare(data, shape, stride);
					setter.set_from_chunk(out, out_selection, chunk, chunk_selection);
				})
				.catch((err) => {
					// re-throw error if not a missing chunk
					if (!(err instanceof KeyError)) throw err;
					// KeyError, we need to fill the corresponding array
					if (arr.fill_value) {
						setter.set_scalar(out, out_selection, arr.fill_value);
					}
				})
		);
	}

	await queue.onIdle();

	// If the final out shape is empty, we just return a scalar.
	return indexer.shape.length === 0 ? unwrap(out.data, 0) : out as any;
}
