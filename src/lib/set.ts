import { KeyError } from "./errors";
import { create_queue } from "./util";
import { BasicIndexer } from "./indexing";
import type { ZarrArray } from "./hierarchy";

import type {
	ArraySelection,
	BasicSetter,
	DataType,
	Indices,
	NdArrayLike,
	NdArraySetter,
	Scalar,
	SetOptions,
	Setter,
	Store,
	TypedArray,
} from "../types";

export const register = {
	basic(setter: BasicSetter<DataType>) {
		return function <D extends DataType>(
			arr: ZarrArray<D, Store>,
			selection: ArraySelection,
			value: Scalar<D> | ReturnType<BasicSetter<D>["prepare"]>,
			opts: SetOptions = {},
		) {
			return set(setter as any as BasicSetter<D>, arr, selection, value, opts);
		};
	},
	ndarray(setter: NdArraySetter<DataType>) {
		return function <D extends DataType>(
			arr: ZarrArray<D, Store>,
			selection: ArraySelection,
			value: Scalar<D> | ReturnType<NdArraySetter<D>["prepare"]>,
			opts: SetOptions = {},
		) {
			return set(setter as any as NdArraySetter<D>, arr, selection, value, opts);
		};
	},
};

async function set<D extends DataType, A extends NdArrayLike<D>>(
	setter: Setter<D, A>,
	arr: ZarrArray<D, Store>,
	selection: ArraySelection,
	value: Scalar<D> | A,
	opts: SetOptions,
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
	for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
		queue.add(async () => {
			// obtain key for chunk storage
			const chunk_key = arr.chunk_key(chunk_coords);

			/** @type {TypedArray<Dtype>} */
			let cdata: TypedArray<D>;

			if (is_total_slice(chunk_selection, arr.chunk_shape)) {
				// totally replace
				cdata = new arr.TypedArray(chunk_size);
				// optimization: we are completely replacing the chunk, so no need
				// to access the exisiting chunk data
				if (typeof value === "object") {
					// Otherwise data just contiguous TypedArray
					const chunk = setter.prepare(cdata, arr.chunk_shape);
					setter.set_from_chunk(chunk, chunk_selection, value, out_selection);
				} else {
					// @ts-ignore
					cdata.fill(value);
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

				const chunk = setter.prepare(cdata, arr.chunk_shape);

				// Modify chunk data
				if (typeof value === "object") {
					setter.set_from_chunk(chunk, chunk_selection, value, out_selection);
				} else {
					setter.set_scalar(chunk, chunk_selection, value);
				}
			}
			// encode chunk
			const encoded_chunk_data = await arr._encode_chunk(cdata);
			// store
			await arr.store.set(chunk_key, encoded_chunk_data);
		});
	}
	await queue.onIdle();
}

function is_total_slice(
	selection: (number | Indices)[],
	shape: number[],
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
