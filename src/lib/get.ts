import { KeyError } from "./errors";
import { BasicIndexer } from "./indexing";
import { create_queue } from "./util";
import type { ZarrArray } from "./hierarchy";
import type {
	ArraySelection,
	BasicSetter,
	DataType,
	GetOptions,
	NdArrayLike,
	NdArraySetter,
	Scalar,
	Setter,
	Store,
	TypedArray,
} from "../types";

export const register = {
	basic(setter: BasicSetter<DataType>) {
		return function <
			D extends DataType,
			S extends Store,
		>(arr: ZarrArray<D, S>, selection: ArraySelection, opts: GetOptions = {}) {
			return get(setter as any as BasicSetter<D>, arr, selection, opts);
		};
	},
	ndarray(setter: NdArraySetter<DataType>) {
		return function <
			D extends DataType,
			S extends Store,
		>(arr: ZarrArray<D, S>, selection: ArraySelection, opts: GetOptions = {}) {
			return get(setter as any as NdArraySetter<D>, arr, selection, opts);
		};
	},
};

const get_value = <D extends DataType>(arr: TypedArray<D>, idx: number): Scalar<D> => {
	return "get" in arr ? arr.get(idx) : arr[idx] as any;
};

async function get<
	D extends DataType,
	A extends NdArrayLike<D>,
>(
	setter: Setter<D, A>,
	arr: ZarrArray<D, Store>,
	selection: ArraySelection,
	opts: GetOptions,
): Promise<A | Scalar<D>> {
	const indexer = new BasicIndexer({
		selection,
		shape: arr.shape,
		chunk_shape: arr.chunk_shape,
	});
	// Setup output array
	const outsize = indexer.shape.reduce((a, b) => a * b, 1);
	const out = setter.prepare(new arr.TypedArray(outsize), indexer.shape);
	const queue = opts.create_queue ? opts.create_queue() : create_queue();

	// iterator over chunks
	for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
		queue.add(() =>
			arr.get_chunk(chunk_coords)
				.then(({ data, shape }) => {
					const chunk = setter.prepare(data, shape);
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
	return indexer.shape.length === 0 ? get_value(out.data, 0) : out;
}
