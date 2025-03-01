import ndarray from "ndarray";
import ops from "ndarray-ops";
import * as zarr from "zarrita";

/**
 * @internal - For testing, don't use in production code.
 */
export const _setter: {
	prepare: <D extends zarr.DataType>(
		data: zarr.TypedArray<D>,
		shape: number[],
		stride: number[],
	) => ndarray.NdArray<zarr.TypedArray<D>>;
	set_scalar: <D extends zarr.DataType>(
		target: ndarray.NdArray<zarr.TypedArray<D>>,
		selection: (zarr.Indices | number)[],
		value: zarr.Scalar<D>,
	) => void;
	set_from_chunk: <D extends zarr.DataType>(
		a: ndarray.NdArray<zarr.TypedArray<D>>,
		b: ndarray.NdArray<zarr.TypedArray<D>>,
		proj: zarr.Projection[],
	) => void;
} = {
	prepare: ndarray,
	set_scalar<D extends zarr.DataType>(
		dest: ndarray.NdArray<zarr.TypedArray<D>>,
		selection: (number | zarr.Indices)[],
		value: zarr.Scalar<D>,
	) {
		// @ts-ignore - ndarray-ops types are incorrect
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
	Store extends zarr.Readable,
	Sel extends (null | zarr.Slice | number)[],
>(
	arr: zarr.Array<D, Store>,
	selection: Sel | null = null,
	opts: zarr.GetOptions<Parameters<Store["get"]>[1]> = {},
): Promise<
	null extends Sel[number]
		? ndarray.NdArray<zarr.TypedArray<D>>
		: zarr.Slice extends Sel[number]
			? ndarray.NdArray<zarr.TypedArray<D>>
			: zarr.Scalar<D>
> {
	return zarr._zarrita_internal_get<
		D,
		Store,
		ndarray.NdArray<zarr.TypedArray<D>>,
		Sel
	>(arr, selection, opts, _setter);
}

/** @category Utility */
export async function set<D extends zarr.DataType>(
	arr: zarr.Array<D, zarr.Mutable>,
	selection: (null | zarr.Slice | number)[] | null,
	value: zarr.Scalar<D> | ndarray.NdArray<zarr.TypedArray<D>>,
	opts: zarr.SetOptions = {},
): Promise<void> {
	return zarr._zarrita_internal_set<D, ndarray.NdArray<zarr.TypedArray<D>>>(
		arr,
		selection,
		value,
		opts,
		_setter,
	);
}

function unzip_selections(mapping: zarr.Projection[]): {
	to: (number | zarr.Indices)[];
	from: (number | zarr.Indices)[];
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
	return arr
		.hi(...hi)
		.lo(...lo)
		.step(...step)
		.pick(...pick);
}
