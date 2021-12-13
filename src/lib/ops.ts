import { BoolArray } from "./custom-arrays";
import type { Array } from "./hierarchy";

import type {
	Async,
	Chunk,
	GetOptions,
	Indices,
	Readable,
	SetOptions,
	Slice,
	TypedArray,
	Writeable,
} from "../types";
import type { Bool, ByteStr, DataType, Scalar, UnicodeStr } from "../dtypes";

import { get as get_with_setter } from "./get";
import { set as set_with_setter } from "./set";

// setting fns rely on some TypedArray apis not supported with our custom arrays

export async function get<
	D extends Exclude<DataType, UnicodeStr | ByteStr>,
	Sel extends (null | Slice | number)[],
>(
	arr: Array<D, Readable | Async<Readable>>,
	selection: Sel | null = null,
	opts: GetOptions = {},
) {
	return get_with_setter<D, NdArray<D>, Sel>(arr, selection, opts, {
		prepare: (data, shape) => ({ data, shape, stride: get_strides(shape) }),
		set_scalar(target, selection, value) {
			set_scalar(compat(target), selection, cast_scalar(target, value));
		},
		set_from_chunk(target, target_selection, chunk, chunk_selection) {
			set_from_chunk(compat(target), target_selection, compat(chunk), chunk_selection);
		},
	});
}

export async function set<
	D extends Exclude<DataType, UnicodeStr | ByteStr>,
>(
	arr: Array<D, (Readable & Writeable) | Async<Readable & Writeable>>,
	selection: (null | Slice | number)[] | null,
	value: Scalar<D> | Chunk<D>,
	opts: SetOptions = {},
) {
	return set_with_setter<D, Chunk<D>>(arr, selection, value, opts, {
		prepare: (data, shape) => ({ data, shape, stride: get_strides(shape) }),
		set_scalar(target, selection, value) {
			set_scalar(compat(target), selection, cast_scalar(target, value));
		},
		set_from_chunk(target, target_selection, chunk, chunk_selection) {
			set_from_chunk(compat(target), target_selection, compat(chunk), chunk_selection);
		},
	});
}

type NdArray<D extends DataType> = {
	data: TypedArray<D>;
	shape: number[];
	stride: number[];
};

function compat<
	D extends Exclude<DataType, UnicodeStr | ByteStr>,
>(
	arr: Chunk<D> & { stride?: number[] },
): NdArray<Exclude<DataType, UnicodeStr | ByteStr | Bool>> {
	// ensure strides are computed
	return {
		data: arr.data instanceof BoolArray ? (new Uint8Array(arr.data.buffer)) : arr.data,
		stride: "stride" in arr ? arr.stride : get_strides(arr.shape),
	} as any;
}

const cast_scalar = <D extends Exclude<DataType, UnicodeStr | ByteStr>>(
	arr: Chunk<D>,
	value: Scalar<D>,
): Scalar<Exclude<DataType, UnicodeStr | ByteStr | Bool>> => {
	if (arr.data instanceof BoolArray) return value ? 1 : 0;
	return value as any;
};

/** Compute strides for 'C' ordered ndarray from shape */
function get_strides(shape: number[]) {
	const ndim = shape.length;
	const strides: number[] = globalThis.Array(ndim);
	let step = 1; // init step
	for (let i = ndim - 1; i >= 0; i--) {
		strides[i] = step;
		step *= shape[i];
	}
	return strides;
}

function indices_len(start: number, stop: number, step: number) {
	if (step < 0 && stop < start) {
		return Math.floor((start - stop - 1) / -step) + 1;
	}
	if (start < stop) return Math.floor((stop - start - 1) / step) + 1;
	return 0;
}

function set_scalar<D extends Exclude<DataType, ByteStr | UnicodeStr | Bool>>(
	out: Pick<NdArray<D>, "data" | "stride">,
	out_selection: (number | Indices)[],
	value: Scalar<D>,
) {
	if (out_selection.length === 0) {
		out.data[0] = value;
		return;
	}
	const [slice, ...slices] = out_selection;
	const [curr_stride, ...stride] = out.stride;
	if (typeof slice === "number") {
		const data = out.data.subarray(curr_stride * slice);
		// @ts-ignore
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
		const data = out.data.subarray(curr_stride * (from + step * i));
		// @ts-ignore
		set_scalar({ data, stride }, slices, value);
	}
}

function set_from_chunk<D extends Exclude<DataType, ByteStr | UnicodeStr | Bool>>(
	out: Pick<NdArray<D>, "data" | "stride">,
	out_selection: (number | Indices)[],
	chunk: Pick<NdArray<D>, "data" | "stride">,
	chunk_selection: (number | Indices)[],
) {
	if (chunk_selection.length === 0) {
		// Case when last chunk dim is squeezed
		// @ts-ignore
		out.data.set(chunk.data.subarray(0, out.data.length));
		return;
	}
	// Get current indicies and strides for both destination and source arrays
	const [out_slice, ...out_slices] = out_selection;
	const [chunk_slice, ...chunk_slices] = chunk_selection;

	const [chunk_stride = 1, ...chunk_strides] = chunk.stride;

	if (typeof chunk_slice === "number") {
		// chunk dimension is squeezed
		const chunk_view = {
			data: chunk.data.subarray(chunk_stride * chunk_slice),
			stride: chunk_strides,
		};
		// @ts-ignore
		set_from_chunk(out, out_selection, chunk_view, chunk_slices);
		return;
	}

	const [out_stride = 1, ...out_strides] = out.stride;

	if (typeof out_slice === "number") {
		// out dimension is squeezed
		const out_view = {
			data: out.data.subarray(out_stride * out_slice),
			stride: out_strides,
		};
		// @ts-ignore
		set_from_chunk(out_view, out_slices, chunk, chunk_selection);
		return;
	}

	const [from, to, step] = out_slice; // only need len of out slice since chunk subset
	const [cfrom, _cto, cstep] = chunk_slice;

	const len = indices_len(from, to, step);
	if (out_slices.length === 0 && chunk_slices.length === 0) {
		if (
			step === 1 && cstep === 1 && out_stride === 1 && chunk_stride === 1
		) {
			// @ts-ignore
			out.data.set(chunk.data.subarray(cfrom, cfrom + len), from);
		} else {
			for (let i = 0; i < len; i++) {
				out.data[out_stride * (from + step * i)] =
					chunk.data[chunk_stride * (cfrom + cstep * i)];
			}
		}
		return;
	}
	for (let i = 0; i < len; i++) {
		const out_view = {
			data: out.data.subarray(out_stride * (from + i * step)),
			stride: out_strides,
		};
		const chunk_view = {
			data: chunk.data.subarray(chunk_stride * (cfrom + i * cstep)),
			stride: chunk_strides,
		};
		set_from_chunk(out_view, out_slices, chunk_view, chunk_slices);
	}
}
