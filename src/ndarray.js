// @ts-check
import ndarray from 'ndarray';
// @ts-ignore
import ops from 'ndarray-ops';

import { register as registerGet } from './lib/get.js';
import { register as registerSet } from './lib/set.js';

/** @typedef {import('./types').DataType} DataType */
/** @typedef {import('./types').Indices} Indices */
/**
 * @template {DataType} D
 * @typedef {import('./types').TypedArray<D>} TypedArray
 */

const setter = {
  prepare: ndarray,
  /** @template {DataType} D*/
  set_scalar(
    /** @type {ndarray.NdArray<TypedArray<D>>} */ target,
    /** @type {(number | Indices)[]} */ selection,
    /** @type {import('./types').Scalar<D>} */ value,
  ) {
    // types aren't correct for ops
    ops.assigns(view(target, selection), /** @type {number} */ (value));
  },
  /** @template {DataType} D*/
  set_from_chunk(
    /** @type {ndarray.NdArray<TypedArray<D>>} */ target,
    /** @type {(number | Indices)[]} */ target_selection,
    /** @type {ndarray.NdArray<TypedArray<D>>} */ chunk,
    /** @type {(number | Indices)[]} */ chunk_selection,
  ) {
    ops.assign(
      view(target, target_selection),
      view(chunk, chunk_selection),
    );
  },
};

export const set = registerSet.ndarray(setter);
export const get = registerGet.ndarray(setter);

/**
 * Convert zarrita selection to ndarray view.
 *
 * @template {DataType} Dtype
 * @param {ndarray.NdArray<TypedArray<Dtype>>} arr
 * @param {(Indices | number)[]} sel
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

  sel.forEach((s, i) => {
    if (typeof s === 'number') {
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
