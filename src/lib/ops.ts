import { register as registerGet } from "./get";
import { register as registerSet } from "./set";

import { BoolArray } from "./custom-arrays";

import type {
	BinaryDataType,
	DataType,
	Indices,
	NdArrayLike,
	Scalar,
	StringDataType,
	TypedArray,
} from "../types";

type NdArray<D extends DataType> = {
	stride: number[];
} & NdArrayLike<D>;

const compat = <D extends DataType>(
	arr: NdArrayLike<D> & { stride?: number[] },
): any => {
	// ensure strides are computed
	return {
		data: arr.data instanceof BoolArray ? (new Uint8Array(arr.data.buffer)) : arr.data,
		stride: "stride" in arr ? arr.stride : get_strides(arr.shape),
	};
};

const cast_scalar = <D extends DataType>(
	arr: NdArrayLike<D>,
	value: Scalar<D>,
): any => {
	if (arr.data instanceof BoolArray) return value ? 1 : 0;
	return value;
};

const setter = {
	prepare: <D extends DataType>(
		data: TypedArray<D>,
		shape: number[],
	) => ({ data, shape, stride: get_strides(shape) }),
	/** @template {DataType} D */
	set_scalar<D extends DataType>(
		out: NdArray<D>,
		out_selection: (Indices | number)[],
		value: Scalar<D>,
	) {
		return set_scalar(compat(out), out_selection, cast_scalar(out, value));
	},
	set_from_chunk<D extends DataType>(
		out: NdArray<D>,
		out_selection: (Indices | number)[],
		chunk: NdArray<D>,
		chunk_selection: (Indices | number)[],
	) {
		return set_from_chunk(
			compat(out),
			out_selection,
			compat(chunk),
			chunk_selection,
		);
	},
};

export const get = registerGet.basic(setter);
export const set = registerSet.basic(setter);

/** Compute strides for 'C' ordered ndarray from shape */
function get_strides(shape: number[]) {
	const ndim = shape.length;
	const strides: number[] = Array(ndim);
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

// setting fns rely on some TypedArray apis not supported with our custom arrays
type SupportedDataType = Exclude<DataType, BinaryDataType | StringDataType>;

function set_scalar<D extends SupportedDataType>(
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

function set_from_chunk<D extends SupportedDataType>(
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
