import ndarray from "ndarray";
// @ts-expect-error
import ops from "ndarray-ops";
import { get_with_setter, set_with_setter } from "@zarrita/core";

import type * as zarr from "@zarrita/core/types";

export const setter = {
	prepare: ndarray,
	set_scalar<D extends zarr.DataType>(
		dest: ndarray.NdArray<zarr.TypedArray<D>>,
		selection: (number | zarr.Indices)[],
		value: zarr.Scalar<D>,
	) {
		ops.assigns(view(dest, selection), value);
	},
	set_from_chunk<D extends zarr.DataType>(
		dest: ndarray.NdArray<zarr.TypedArray<D>>,
		src: ndarray.NdArray<zarr.TypedArray<D>>,
		mapping: zarr.Projection[],
	) {
		const s = unzip_selections(mapping);
		ops.assign(view(dest, s.to), view(src, s.from));
	},
};

/** @category Utility */
export async function get<
	D extends zarr.DataType,
	Store extends zarr.Readable | zarr.Async<zarr.Readable>,
	Sel extends (null | zarr.Slice | number)[],
>(
	arr: zarr.Array<D, Store>,
	selection: Sel | null = null,
	opts: zarr.GetOptions<Parameters<Store["get"]>[1]> = {},
) {
	return get_with_setter<D, Store, ndarray.NdArray<zarr.TypedArray<D>>, Sel>(
		arr,
		selection,
		opts,
		setter,
	);
}

/** @category Utility */
export async function set<D extends zarr.DataType>(
	arr: zarr.Array<D, (zarr.Readable & zarr.Writeable) | zarr.Async<zarr.Readable & zarr.Writeable>>,
	selection: (null | zarr.Slice | number)[] | null,
	value: zarr.Scalar<D> | ndarray.NdArray<zarr.TypedArray<D>>,
	opts: zarr.SetOptions = {},
) {
	return set_with_setter<D, ndarray.NdArray<zarr.TypedArray<D>>>(
		arr,
		selection,
		value,
		opts,
		setter,
	);
}

function unzip_selections(
	mapping: zarr.Projection[],
): { to: (number | zarr.Indices)[]; from: (number | zarr.Indices)[] } {
	const to = [], from = [];
	for (const m of mapping) {
		if (m.to !== null) to.push(m.to);
		if (m.from !== null) from.push(m.from);
	}
	return { to, from };
}

/** Convert zarrita selection to ndarray view. */
function view<D extends zarr.DataType>(
	arr: ndarray.NdArray<zarr.TypedArray<D>>,
	sel: (number | zarr.Indices)[],
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
