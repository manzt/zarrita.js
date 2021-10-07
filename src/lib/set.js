// @ts-check
import { KeyError } from './errors.js';
import { create_queue, parse_dtype } from './util.js';
import { BasicIndexer } from './indexing.js';

/** @typedef {import('../types').DataType} DataType */
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
 * @template {DataType} Dtype
 * @typedef {import('../types').NdArrayLike<Dtype>} NdArrayLike
 */
/**
 * @template {DataType} Dtype
 * @typedef {import('./hierarchy').ZarrArray<Dtype, import('../types').Store>} ZarrArray
 */

/**
 * @template {DataType} Dtype
 * @template {import('../types').NdArrayLike<Dtype>} NdArray
 * @param {import('../types').Setter<Dtype, NdArray>} setter
 */
export function register(setter) {
  /**
   * @template {DataType} Dtype
   * @template {ArraySelection} Sel
   *
   * @param {ZarrArray<Dtype>} arr
   * @param {Sel} selection
   * @param {Scalar<Dtype> | NdArray} value
   * @param {import('../types').SetOptions} opts
   */
  return function (arr, selection, value, opts = {}) {
    return set(setter, arr, selection, value, opts);
  };
}

/**
 * @template {DataType} Dtype
 * @template {NdArrayLike<Dtype>} NdArray
 *
 * @param {import('../types').Setter<Dtype, NdArray>} setter
 * @param {ZarrArray<Dtype>} arr
 * @param {ArraySelection} selection
 * @param {Scalar<Dtype> | NdArray} value
 * @param {import('../types').SetOptions} opts
 * @returns {Promise<void>}
 */
async function set(setter, arr, selection, value, opts) {
  const indexer = new BasicIndexer({ selection, shape: arr.shape, chunk_shape: arr.chunk_shape });

  // We iterate over all chunks which overlap the selection and thus contain data
  // that needs to be replaced. Each chunk is processed in turn, extracting the
  // necessary data from the value array and storing into the chunk array.

  const chunk_size = arr.chunk_shape.reduce((a, b) => a * b, 1);
  const { create, fill } = parse_dtype(arr.dtype);
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
        // totally replace chunk

        // optimization: we are completely replacing the chunk, so no need
        // to access the exisiting chunk data
        if (typeof value === 'object') {
          // Otherwise data just contiguous TypedArray
          const chunk = setter.prepare(create(chunk_size), arr.chunk_shape);
          setter.set_from_chunk(chunk, chunk_selection, value, out_selection);
          cdata = chunk.data;
        } else {
          cdata = create(chunk_size);
          fill(cdata, value);
        }
      } else {
        // partially replace the contents of this chunk
        /** @type {NdArray} */
        const chunk = await arr.get_chunk(chunk_coords)
          .then(({ data, shape }) => setter.prepare(data, shape))
          .catch((err) => {
            if (!(err instanceof KeyError)) throw err;
            const empty = create(chunk_size);
            if (arr.fill_value) fill(empty, arr.fill_value);
            return setter.prepare(empty, arr.chunk_shape);
          });

        // Modify chunk data
        if (typeof value === 'object') {
          setter.set_from_chunk(chunk, chunk_selection, value, out_selection);
        } else {
          setter.set_scalar(chunk, chunk_selection, value);
        }

        cdata = chunk.data;
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
