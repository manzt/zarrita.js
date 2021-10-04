// @ts-check
import { register as registerGet } from './get.js';
import { register as registerSet } from './set.js';

import { BoolArray } from './custom-arrays.js';

/** @typedef {import('../types').Indices} Indices */
/** @typedef {import('../types').DataType} DataType*/
/**
 * @template {DataType} Dtype
 * @typedef {{ stride: number[] } & import('../types').NdArrayLike<Dtype>} NdArray
 */
/**
 * @template {DataType} Dtype
 * @typedef {import('../types').TypedArray<Dtype>} TypedArray
 */
/**
 * @template {DataType} Dtype
 * @typedef {import('../types').Scalar<Dtype>} Scalar
 */

/**
 * Extracts underyling TypedArray to make filling setter functions compatible with
 * higher-level arrays (e.g. BoolArray).
 *
 * @template {DataType} Dtype
 * @param {NdArray<Dtype> | Omit<NdArray<Dtype>, 'stride'>} arr
 * @returns {any}
 */
const compat = (arr) => {
  // ensure strides are computed
  return {
    data: arr.data instanceof BoolArray ? arr.data._bytes : arr.data,
    stride: 'stride' in arr ? arr.stride : get_strides(arr.shape),
  };
};

/**
 * @template {DataType} Dtype
 * @param {{ data: TypedArray<Dtype> }} arr
 * @param {Scalar<Dtype>} value
 * @returns {any}
 */
const cast_scalar = (arr, value) => {
  if (arr.data instanceof BoolArray) return value ? 1 : 0;
  return value;
};

/**
 * @template {DataType} Dtype
 * @type {import('../types').Setter<Dtype, NdArray<Dtype> | Omit<NdArray<Dtype>, 'stride'>>}
 */
const setter = {
  prepare: (data, shape) => ({ data, shape, stride: get_strides(shape) }),
  set_scalar(out, out_selection, value) {
    return set_scalar(
      compat(out),
      out_selection,
      cast_scalar(out, value),
    );
  },
  set_from_chunk(out, out_selection, chunk, chunk_selection) {
    return set_from_chunk(
      compat(out),
      out_selection,
      compat(chunk),
      chunk_selection,
    );
  },
};

export const get = registerGet(setter);
export const set = registerSet(setter);

/**
 * Compute strides for 'C' ordered ndarray from shape
 *
 * @param {number[]} shape
 */
function get_strides(shape) {
  const ndim = shape.length;
  /** @type {number[]} */
  const strides = Array(ndim);
  let step = 1; // init step
  for (let i = ndim - 1; i >= 0; i--) {
    strides[i] = step;
    step *= shape[i];
  }
  return strides;
}
/**
 * @param {number} start
 * @param {number} stop
 * @param {number} step
 */
function indices_len(start, stop, step) {
  if (step < 0 && stop < start) {
    return Math.floor((start - stop - 1) / -step) + 1;
  }
  if (start < stop) return Math.floor((stop - start - 1) / step) + 1;
  return 0;
}

/**
 * @template {Exclude<DataType, '|b1'>} Dtype
 * @param {Pick<NdArray<Dtype>, 'data' | 'stride'>} out
 * @param {(number | Indices)[]} out_selection
 * @param {import('../types').Scalar<Dtype>} value
 */
function set_scalar(out, out_selection, value) {
  if (out_selection.length === 0) {
    out.data[0] = value;
    return;
  }
  const [slice, ...slices] = out_selection;
  const [curr_stride, ...stride] = out.stride;
  if (typeof slice === 'number') {
    const data = /** @type {TypedArray<Dtype>} */ (out.data.subarray(
      curr_stride * slice,
    ));
    set_scalar({ data, stride }, slices, value);
    return;
  }
  const [from, to, step] = slice;
  const len = indices_len(from, to, step);
  if (slices.length === 0) {
    if (step === 1 && curr_stride === 1) {
      /** @type {{ fill: (v: any, start: number, end: number) => void }} */ (out.data).fill(
        value,
        from,
        from + len,
      );
    } else {
      for (let i = 0; i < len; i++) {
        out.data[curr_stride * (from + step * i)] = value;
      }
    }
    return;
  }
  for (let i = 0; i < len; i++) {
    const data = /** @type {TypedArray<Dtype>} */ (out.data.subarray(
      curr_stride * (from + step * i),
    ));
    set_scalar({ data, stride }, slices, value);
  }
}

/**
 * @template {Exclude<DataType, '|b1'>} Dtype
 * @param {Pick<NdArray<Dtype>, 'data' | 'stride'>} out
 * @param {(number | Indices)[]} out_selection
 * @param {Pick<NdArray<Dtype>, 'data' | 'stride'>} chunk
 * @param {(number | Indices)[]} chunk_selection
 */
function set_from_chunk(out, out_selection, chunk, chunk_selection) {
  if (chunk_selection.length === 0) {
    // Case when last chunk dim is squeezed
    /** @type {{ set: (arr: any) => void }} */ (out.data).set(
      chunk.data.subarray(0, out.data.length),
    );
    return;
  }
  // Get current indicies and strides for both destination and source arrays
  const [out_slice, ...out_slices] = out_selection;
  const [chunk_slice, ...chunk_slices] = chunk_selection;

  const [chunk_stride = 1, ...chunk_strides] = chunk.stride;

  if (typeof chunk_slice === 'number') {
    // chunk dimension is squeezed
    const chunk_view = {
      data: /** @type {TypedArray<Dtype>} */ (chunk.data.subarray(
        chunk_stride * chunk_slice,
      )),
      stride: chunk_strides,
    };
    set_from_chunk(out, out_selection, chunk_view, chunk_slices);
    return;
  }

  const [out_stride = 1, ...out_strides] = out.stride;

  if (typeof out_slice === 'number') {
    // out dimension is squeezed
    const out_view = {
      data: /** @type {TypedArray<Dtype>} */ (out.data.subarray(
        out_stride * out_slice,
      )),
      stride: out_strides,
    };
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
      /** @type {{ set: (arr: any, start: number) => void }} */ (out.data).set(
        chunk.data.subarray(cfrom, cfrom + len),
        from,
      );
    } else {
      for (let i = 0; i < len; i++) {
        out.data[out_stride * (from + step * i)] = chunk.data[chunk_stride * (cfrom + cstep * i)];
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
