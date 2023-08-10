import type { Async, Readable, Writeable } from "@zarrita/storage";
import type * as core from "@zarrita/core";
import { BoolArray } from "@zarrita/typedarray";
import { get as get_with_setter } from "./get.js";
import { set as set_with_setter } from "./set.js";
import type {
	GetOptions,
	Indices,
	Projection,
	SetOptions,
	Slice,
} from "./types.js";

// setting fns rely on some TypedArray apis not supported with our custom arrays
type SupportedDataType = core.NumberDataType | core.BigintDataType | core.Bool;

export const setter = {
	prepare<D extends SupportedDataType>(
		data: core.TypedArray<D>,
		shape: number[],
		stride: number[],
	) {
		return { data, shape, stride };
	},
	set_scalar<D extends SupportedDataType>(
		dest: core.Chunk<D>,
		sel: (number | Indices)[],
		value: core.Scalar<D>,
	) {
		set_scalar(compat(dest), sel, cast_scalar(dest, value));
	},
	set_from_chunk<D extends SupportedDataType>(
		dest: core.Chunk<D>,
		src: core.Chunk<D>,
		mapping: Projection[],
	) {
		set_from_chunk(compat(dest), compat(src), mapping);
	},
};

/** @category Utility */
export async function get<
	D extends SupportedDataType,
	Store extends Readable | Async<Readable>,
	Sel extends (null | Slice | number)[],
>(
	arr: core.Array<D, Store>,
	selection: Sel | null = null,
	opts: GetOptions<Parameters<Store["get"]>[1]> = {},
) {
	return get_with_setter<D, Store, core.Chunk<D>, Sel>(
		arr,
		selection,
		opts,
		setter,
	);
}

/** @category Utility */
export async function set<
	D extends SupportedDataType,
>(
	arr: core.Array<D, (Readable & Writeable) | Async<Readable & Writeable>>,
	selection: (null | Slice | number)[] | null,
	value: core.Scalar<D> | core.Chunk<D>,
	opts: SetOptions = {},
) {
	return set_with_setter<D, core.Chunk<D>>(arr, selection, value, opts, setter);
}

function compat<D extends SupportedDataType>(
	arr: core.Chunk<D>,
): core.Chunk<D extends core.Bool ? core.Uint8 : D> {
	// ensure strides are computed
	return {
		// @ts-expect-error
		data: arr.data instanceof BoolArray
			? new Uint8Array(arr.data.buffer)
			: arr.data,
		shape: arr.shape,
		stride: arr.stride,
	};
}

function cast_scalar<D extends core.DataType>(
	arr: core.Chunk<D>,
	value: core.Scalar<D>,
): core.Scalar<D extends core.Bool ? core.Uint8 : D> {
	// @ts-expect-error
	if (arr.data instanceof BoolArray) return value ? 1 : 0;
	return value as any;
}

function indices_len(start: number, stop: number, step: number) {
	if (step < 0 && stop < start) {
		return Math.floor((start - stop - 1) / -step) + 1;
	}
	if (start < stop) return Math.floor((stop - start - 1) / step) + 1;
	return 0;
}

function set_scalar<D extends core.NumberDataType | core.BigintDataType>(
	out: Pick<core.Chunk<D>, "data" | "stride">,
	out_selection: (Indices | number)[],
	value: core.Scalar<D>,
) {
	if (out_selection.length === 0) {
		out.data[0] = value;
		return;
	}
	const [slice, ...slices] = out_selection;
	const [curr_stride, ...stride] = out.stride;

	if (typeof slice === "number") {
		const data = out.data.subarray(curr_stride * slice) as core.TypedArray<D>;
		set_scalar({ data, stride }, slices, value);
		return;
	}

	const [from, to, step] = slice;
	const len = indices_len(from, to, step);
	if (slices.length === 0) {
		if (step === 1 && curr_stride === 1) {
			// @ts-ignore
			out.data.fill(value, from, from + len);
		} else {
			for (let i = 0; i < len; i++) {
				out.data[curr_stride * (from + step * i)] = value;
			}
		}
		return;
	}
	for (let i = 0; i < len; i++) {
		const data = out.data.subarray(
			curr_stride * (from + step * i),
		) as core.TypedArray<D>;
		set_scalar({ data, stride }, slices, value);
	}
}

function set_from_chunk<D extends core.NumberDataType | core.BigintDataType>(
	dest: Pick<core.Chunk<D>, "data" | "stride">,
	src: Pick<core.Chunk<D>, "data" | "stride">,
	projections: Projection[],
) {
	const [proj, ...projs] = projections;
	const [dstride, ...dstrides] = dest.stride;
	const [sstride, ...sstrides] = src.stride;

	if (proj.from === null) {
		if (projs.length === 0) {
			dest.data[proj.to] = src.data[0];
			return;
		}
		set_from_chunk(
			{
				data: dest.data.subarray(dstride * proj.to) as core.TypedArray<D>,
				stride: dstrides,
			},
			src,
			projs,
		);
		return;
	}

	if (proj.to === null) {
		if (projs.length === 0) {
			dest.data[0] = src.data[proj.from];
			return;
		}
		let view = {
			data: src.data.subarray(sstride * proj.from) as core.TypedArray<D>,
			stride: sstrides,
		};
		set_from_chunk(dest, view, projs);
		return;
	}

	const [from, to, step] = proj.to;
	const [sfrom, _, sstep] = proj.from;
	const len = indices_len(from, to, step);

	if (projs.length === 0) {
		if (
			step === 1 && sstep === 1 && dstride === 1 && sstride === 1
		) {
			dest.data.set(src.data.subarray(sfrom, sfrom + len) as any, from);
		} else {
			for (let i = 0; i < len; i++) {
				dest.data[dstride * (from + step * i)] =
					src.data[sstride * (sfrom + sstep * i)];
			}
		}
		return;
	}

	for (let i = 0; i < len; i++) {
		set_from_chunk(
			{
				data: dest.data.subarray(dstride * (from + i * step)),
				stride: dstrides,
			},
			{
				data: src.data.subarray(sstride * (sfrom + i * sstep)),
				stride: sstrides,
			},
			projs,
		);
	}
}
