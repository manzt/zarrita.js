import ndarray from "ndarray";
import ops from "ndarray-ops";

import type * as core from "@zarrita/core";
import { get_with_setter, set_with_setter } from "@zarrita/indexing";
import type {
	GetOptions,
	Indices,
	Projection,
	SetOptions,
	Slice,
} from "@zarrita/indexing";
import type { Mutable, Readable } from "@zarrita/storage";

/**
 * @internal - For testing, don't use in production code.
 */
export const _setter: {
	prepare: <D extends core.DataType>(
		data: core.TypedArray<D>,
		shape: number[],
		stride: number[],
	) => ndarray.NdArray<core.TypedArray<D>>;
	set_scalar: <D extends core.DataType>(
		target: ndarray.NdArray<core.TypedArray<D>>,
		selection: (Indices | number)[],
		value: core.Scalar<D>,
	) => void;
	set_from_chunk: <D extends core.DataType>(
		a: ndarray.NdArray<core.TypedArray<D>>,
		b: ndarray.NdArray<core.TypedArray<D>>,
		proj: Projection[],
	) => void;
} = {
	prepare: ndarray,
	set_scalar<D extends core.DataType>(
		dest: ndarray.NdArray<core.TypedArray<D>>,
		selection: (number | Indices)[],
		value: core.Scalar<D>,
	) {
		// @ts-ignore - ndarray-ops types are incorrect
		ops.assigns(view(dest, selection), value);
	},
	set_from_chunk<D extends core.DataType>(
		dest: ndarray.NdArray<core.TypedArray<D>>,
		src: ndarray.NdArray<core.TypedArray<D>>,
		mapping: Projection[],
	) {
		const s = unzip_selections(mapping);
		ops.assign(view(dest, s.to), view(src, s.from));
	},
};

/** @category Utility */
export async function get<
	D extends core.DataType,
	Store extends Readable,
	Sel extends (null | Slice | number)[],
>(
	arr: core.Array<D, Store>,
	selection: Sel | null = null,
	opts: GetOptions<Parameters<Store["get"]>[1]> = {},
): Promise<
	null extends Sel[number]
		? ndarray.NdArray<core.TypedArray<D>>
		: Slice extends Sel[number]
			? ndarray.NdArray<core.TypedArray<D>>
			: core.Scalar<D>
> {
	return get_with_setter<D, Store, ndarray.NdArray<core.TypedArray<D>>, Sel>(
		arr,
		selection,
		opts,
		_setter,
	);
}

/** @category Utility */
export async function set<D extends core.DataType>(
	arr: core.Array<D, Mutable>,
	selection: (null | Slice | number)[] | null,
	value: core.Scalar<D> | ndarray.NdArray<core.TypedArray<D>>,
	opts: SetOptions = {},
): Promise<void> {
	return set_with_setter<D, ndarray.NdArray<core.TypedArray<D>>>(
		arr,
		selection,
		value,
		opts,
		_setter,
	);
}

function unzip_selections(mapping: Projection[]): {
	to: (number | Indices)[];
	from: (number | Indices)[];
} {
	const to = [];
	const from = [];
	for (const m of mapping) {
		if (m.to !== null) to.push(m.to);
		if (m.from !== null) from.push(m.from);
	}
	return { to, from };
}

/** Convert zarrita selection to ndarray view. */
function view<D extends core.DataType>(
	arr: ndarray.NdArray<core.TypedArray<D>>,
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
	return arr
		.hi(...hi)
		.lo(...lo)
		.step(...step)
		.pick(...pick);
}
