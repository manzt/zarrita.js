// @ts-check
import { KeyError } from './errors.js';
import { create_queue } from './util.js';
import { BasicIndexer } from './indexing.js';

/** @typedef {import('../types').DataType} DataType */
/** @typedef {import('../types').Store} Store */
/** @typedef {import('../types').ArraySelection} ArraySelection */
/** @typedef {import('../types').Slice} Slice */
/** @typedef {import('../types').Indices} Indices */
/**
 * @template {DataType} Dtype
 * @typedef {import('../types').TypedArray<Dtype>} TypedArray
 */
/**
 * @template {DataType} Dtype
 * @typedef {import('../types').Scalar<Dtype>} Scalar
 */

/**
 * @template {import('../types').NdArrayLike<Dtype>} NdArray
 * @param {import('../types').Setter<Dtype, NdArray>} setter
 */
export function register(setter) {
  /**
   * @template {DataType} Dtype
   * @template {ArraySelection} Sel
   *
   * @param {import('./hierarchy').ZarrArray<Dtype, Store>} arr
   * @param {Sel} selection
   * @param {Scalar<Dtype> | import('../types').NdArrayLike<Dtype>} value
   * @param {import('../types').SetOptions} opts
   */
  return function (arr, selection, value, opts = {}) {
    return set(setter, arr, selection, value, opts);
  };
}

/**
 * @template {DataType} Dtype
 *
 * @param {import('../types').Setter<Dtype, import('../types').NdArrayLike<Dtype>>} setter
 * @param {import('./hierarchy').ZarrArray<Dtype, Store>} arr
 * @param {ArraySelection} selection
 * @param {Scalar<Dtype> | import('../types').NdArrayLike<Dtype>} value
 * @param {import('../types').SetOptions} opts
 * @returns {Promise<void>}
 */
async function set(setter, arr, selection, value, opts) {
  const indexer = new BasicIndexer({ selection, shape: arr.shape, chunk_shape: arr.chunk_shape });

  // We iterate over all chunks which overlap the selection and thus contain data
  // that needs to be replaced. Each chunk is processed in turn, extracting the
  // necessary data from the value array and storing into the chunk array.

  const chunk_size = arr.chunk_shape.reduce((a, b) => a * b, 1);
  const queue = opts.create_queue ? opts.create_queue() : create_queue();

  // N.B., it is an important optimisation that we only visit chunks which overlap
  // the selection. This minimises the number of iterations in the main for loop.
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    queue.add(async () => {
      // obtain key for chunk storage
      const chunk_key = arr.chunk_key(chunk_coords);

      /** @type {TypedArray<Dtype>} */
      let cdata;

      if (is_total_slice(chunk_selection, arr.chunk_shape)) {
        // totally replace
        cdata = new arr.TypedArray(chunk_size);
        // optimization: we are completely replacing the chunk, so no need
        // to access the exisiting chunk data
        if (typeof value === 'object') {
          // Otherwise data just contiguous TypedArray
          const chunk = setter.prepare(cdata, arr.chunk_shape);
          setter.set_from_chunk(chunk, chunk_selection, value, out_selection);
        } else {
          cdata.fill(value);
        }
      } else {
        // partially replace the contents of this chunk
        cdata = await arr.get_chunk(chunk_coords)
          .then(({ data }) => data)
          .catch((err) => {
            if (!(err instanceof KeyError)) throw err;
            const empty = new arr.TypedArray(chunk_size);
            if (arr.fill_value) empty.fill(arr.fill_value);
            return empty;
          });

        const chunk = setter.prepare(cdata, arr.chunk_shape);

        // Modify chunk data
        if (typeof value === 'object') {
          setter.set_from_chunk(chunk, chunk_selection, value, out_selection);
        } else {
          setter.set_scalar(chunk, chunk_selection, value);
        }
      }
      // encode chunk
      const encoded_chunk_data = await arr._encode_chunk(cdata);
      // store
      await arr.store.set(chunk_key, encoded_chunk_data);
    });
  }
  await queue.onIdle();
}

/**
 * @param {(number | Indices)[]} selection
 * @param {number[]} shape
 * @returns {selection is Indices[]}
 */
function is_total_slice(selection, shape) {
  // all items are Indices and every slice is complete
  return selection.every((s, i) => {
    // can't be a full selection
    if (typeof s === 'number') return false;
    // explicit complete slice
    const [start, stop, step] = s;
    return stop - start === shape[i] && step === 1;
  });
}
