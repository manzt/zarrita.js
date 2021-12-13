import ndarray from "ndarray";
// @ts-ignore
import ops from "ndarray-ops";

import type {
	Async,
	DataType,
	GetOptions,
	Indices,
	Readable,
	Scalar,
	SetOptions,
	Slice,
	TypedArray,
	Writeable,
} from "./types";
import type { Array } from "./lib/hierarchy";

import { get as get_with_setter } from "./lib/get";
import { set as set_with_setter } from "./lib/set";

export async function get<
	D extends DataType,
	Sel extends (null | Slice | number)[],
>(
	arr: Array<D, Readable | Async<Readable>>,
	selection: Sel | null = null,
	opts: GetOptions = {},
) {
	return get_with_setter<D, ndarray.NdArray<TypedArray<D>>, Sel>(arr, selection, opts, {
		prepare: ndarray,
		set_scalar(target, selection, value) {
			ops.assigns(view(target, selection), value);
		},
		set_from_chunk(target, target_selection, chunk, chunk_selection) {
			ops.assign(
				view(target, target_selection),
				view(chunk, chunk_selection),
			);
		},
	});
}

export async function set<D extends DataType>(
	arr: Array<D, (Readable & Writeable) | Async<Readable & Writeable>>,
	selection: (null | Slice | number)[] | null,
	value: Scalar<D> | ndarray.NdArray<TypedArray<D>>,
	opts: SetOptions = {},
) {
	return set_with_setter<D, ndarray.NdArray<TypedArray<D>>>(arr, selection, value, opts, {
		prepare: ndarray,
		set_scalar(target, selection, value) {
			ops.assigns(view(target, selection), value);
		},
		set_from_chunk(target, target_selection, chunk, chunk_selection) {
			ops.assign(
				view(target, target_selection),
				view(chunk, chunk_selection),
			);
		},
	});
}

/** Convert zarrita selection to ndarray view. */
function view<D extends DataType>(
	arr: ndarray.NdArray<TypedArray<D>>,
	sel: (number | Indices)[],
) {
	const lo: number[] = [];
	const hi: number[] = [];
	const step: number[] = [];
	const pick: (number | null)[] = [];

	sel.forEach((s, i) => {
		if (typeof s === "number") {
			lo.push(0);
			hi.push(arr.shape[i]);
			step.push(1);
			pick.push(s);
			return;
		}
		lo.push(s[0]);
		hi.push(s[1]);
		step.push(s[2]);
		pick.push(null);
	});

	return arr.hi(...hi).lo(...lo).step(...step).pick(...pick);
}
