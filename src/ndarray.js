// @ts-check
import ndarray from 'ndarray';
import { product, range } from './lib/util.js';

/** @typedef {import('./types').DataType} DataType */
/**
 * @template {DataType} Dtype
 * @typedef {import('./types').TypedArray<Dtype>} TypedArray
 */
/** @typedef {import('./types').Slice} Slice */

/** @param {number[]} shape */
function shape_product(shape) {
  return product(...shape.map((x) => [...range(x)]));
}

/**
 * Convert zarrita selection to ndarray view.
 *
 * @template {DataType} Dtype
 * @param {ndarray.NdArray<TypedArray<Dtype>>} arr
 * @param {(null | Slice | number)[]} sel
 */
function get_view(arr, sel) {
  /** @type {number[]} */
  const lo = [],
    /** @type {number[]} */
    hi = [],
    /** @type {number[]} */
    step = [],
    /** @type {(number | null)[]} */
    pick = [];

  let squeezed = false;
  sel.forEach((s, i) => {
    if (s === null) {
      squeezed = true;
      return;
    }
    if (typeof s === 'number') {
      lo.push(0);
      hi.push(arr.shape[i]);
      step.push(1);
      pick.push(s);
      return;
    }
    const [from, to, st] = s.indices(arr.shape[i]);
    lo.push(from);
    hi.push(to);
    step.push(st);
    pick.push(null);
  });

  if (squeezed) {
    arr = ndarray(arr.data, arr.shape.filter((_, i) => sel[i] !== null));
  }

  return arr.lo(...lo).hi(...hi).step(...step).pick(...pick);
}

/**
 * @template {DataType} Dtype
 * @type {import('./types').Setter<Dtype, ndarray.NdArray<TypedArray<Dtype>>>}
 */
export const setter = {
  prepare: ndarray,
  set_scalar(target, selection, value) {
    const view = get_view(target, selection);
    for (const d of shape_product(view.shape)) {
      view.set(...d, value);
    }
  },
  set_from_chunk(target, target_selection, chunk, chunk_selection) {
    const target_view = get_view(target, target_selection);
    const chunk_view = get_view(chunk, chunk_selection);
    for (const d of shape_product(chunk_view.shape)) {
      target_view.set(...d, chunk_view.get(...d));
    }
  },
};
