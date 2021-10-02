// @ts-check
import { KeyError } from './errors.js';
import { parse_dtype, slice } from './util.js';
import { BasicIndexer } from './indexing.js';

/** @typedef {import('../types').DataType} DataType */
/** @typedef {import('../types').ArraySelection} ArraySelection */
/** @typedef {import('../types').Slice} Slice */
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
 * @typedef {import('../hierarchy').ZarrArray<Dtype, import('../types').Store>} ZarrArray
 */

/**
 * @template {DataType} Dtype
 * @template {import('../types').NdArrayLike<Dtype>} NdArray
 * @param {import('../types').Setter<Dtype, NdArray>} setter
 */
export function register(setter) {
  /**
   * @template {DataType} Dtype
   * @this {ZarrArray<Dtype>}
   *
   * @template {ArraySelection} Sel
   * @param {Sel} selection
   * @param {Scalar<Dtype> | NdArray} value
   */
  return function (selection, value) {
    return set(setter, this, selection, value);
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
 * @returns {Promise<void>}
 */
async function set(setter, arr, selection, value) {
  const indexer = new BasicIndexer({ selection, shape: arr.shape, chunk_shape: arr.chunk_shape });

  // We iterate over all chunks which overlap the selection and thus contain data
  // that needs to be replaced. Each chunk is processed in turn, extracting the
  // necessary data from the value array and storing into the chunk array.

  const chunk_size = arr.chunk_shape.reduce((a, b) => a * b, 1);
  const { create } = parse_dtype(arr.dtype);

  // N.B., it is an important optimisation that we only visit chunks which overlap
  // the selection. This minimises the number of iterations in the main for loop.
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
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
        const full_selection = arr.chunk_shape.map(() => slice(null));
        setter.set_from_chunk(chunk, full_selection, value, out_selection);
        cdata = chunk.data;
      } else {
        cdata = /** @type {TypedArray<Dtype>} */ (create(chunk_size).fill(value));
      }
    } else {
      // partially replace the contents of this chunk
      /** @type {NdArray} */
      const chunk = await arr.get_chunk(chunk_coords)
        .then(({ data, shape }) => setter.prepare(data, shape))
        .catch((err) => {
          if (!(err instanceof KeyError)) throw err;
          const empty = create(chunk_size);
          return setter.prepare(
            arr.fill_value ? /** @type {TypedArray<Dtype>} */ (empty.fill(arr.fill_value)) : empty,
            arr.chunk_shape,
          );
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
  }
}

/**
 * @param {(null | number | Slice)[]} items
 * @param {number[]} shape
 * @returns {boolean}
 */
function is_total_slice(items, shape) {
  for (let i = 0; i < items.length; i++) {
    const s = items[i];

    if (typeof s === 'number') {
      return false; // can't be a full slice, return early.
    }

    if (s === null) {
      continue; // complete slice
    }

    if (s.start === null && s.stop === null && s.step === null) {
      continue; // null slice
    }

    const dim_len = shape[i];
    const [start, stop, step] = s.indices(dim_len);
    if (stop - start === dim_len && step === 1) {
      continue; // explicit complete slice
    }

    return false;
  }

  return true;
}
