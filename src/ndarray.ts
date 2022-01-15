import ndarray from "ndarray";
// @ts-ignore
import ops from "ndarray-ops";

import type {
	Async,
	DataType,
	GetOptions,
	Indices,
	Projection,
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

/** @category Utility */
export async function get<
	D extends DataType,
	Store extends Readable | Async<Readable>,
	Sel extends (null | Slice | number)[],
>(
	arr: Array<D, Store>,
	selection: Sel | null = null,
	opts: GetOptions<Parameters<Store["get"]>[1]> = {},
) {
	return get_with_setter<D, Store, ndarray.NdArray<TypedArray<D>>, Sel>(
		arr,
		selection,
		opts,
		{
			prepare: ndarray,
			set_scalar(target, selection, value) {
				const s = selection.filter((s): s is Indices | number => s !== null);
				ops.assigns(view(target, s), value);
			},
			set_from_chunk(dest, src, mapping) {
				const s = extract_sel(mapping);
				ops.assign(view(dest, s.to), view(src, s.from));
			},
		},
	);
}

/** @category Utility */
export async function set<D extends DataType>(
	arr: Array<D, (Readable & Writeable) | Async<Readable & Writeable>>,
	selection: (null | Slice | number)[] | null,
	value: Scalar<D> | ndarray.NdArray<TypedArray<D>>,
	opts: SetOptions = {},
) {
	return set_with_setter<D, ndarray.NdArray<TypedArray<D>>>(arr, selection, value, opts, {
		prepare: ndarray,
		set_scalar(target, selection, value) {
			const s = selection.filter((s): s is Indices | number => s !== null);
			ops.assigns(view(target, s), value);
		},
		set_from_chunk(dest, src, mapping) {
			const s = extract_sel(mapping);
			ops.assign(view(dest, s.to), view(src, s.from));
		},
	});
}

function extract_sel(
	mapping: Projection[],
): { to: (number | Indices)[]; from: (number | Indices)[] } {
	const to = [], from = [];
	for (const m of mapping) {
		if (m.to) to.push(m.to);
		if (m.from) from.push(m.from);
	}
	return { to, from };
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
