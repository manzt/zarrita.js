// @ts-check
import ndarray from 'ndarray';
import ops from 'ndarray-ops';

import { register as registerGet } from './lib/get.js';
import { register as registerSet } from './lib/set.js';

/** @typedef {import('./types').DataType} DataType */
/** @typedef {import('./types').Slice} Slice */
/**
 * @template {DataType} Dtype
 * @typedef {import('./types').TypedArray<Dtype>} TypedArray
 */
/**
 * @template {DataType} Dtype
 * @template {import('./types').NdArrayLike<Dtype>} NdArray
 * @typedef {import('./types').Setter<Dtype, NdArray>} Setter
 */

/**
 * @template {DataType} Dtype
 * @type {Setter<Dtype, ndarray.NdArray<TypedArray<Dtype>>>}
 */
const setter = {
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
};

export const set = registerSet(setter);
export const get = registerGet(setter);

/**
 * Convert zarrita selection to ndarray view.
 *
 * @template {DataType} Dtype
 * @param {ndarray.NdArray<TypedArray<Dtype>>} arr
 * @param {(null | Slice | number)[]} sel
 */
function view(arr, sel) {
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

  return arr.hi(...hi).lo(...lo).step(...step).pick(...pick);
}
