// @ts-check
import { KeyError } from './errors.js';
import { BasicIndexer } from './indexing.js';
import { create_queue, parse_dtype } from './util.js';

/** @typedef {import('../types').DataType} DataType */
/** @typedef {import('../types').ArraySelection} ArraySelection */
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
   * @this {ZarrArray<Dtype>}
   *
   * @template {ArraySelection} Sel
   * @param {Sel} selection
   * @param {import('../types').Options} opts
   */
  return function (selection, opts = {}) {
    return get(setter, this, selection, opts);
  };
}

/**
 * @template {DataType} Dtype
 * @param {import('../types').TypedArray<Dtype>} arr
 * @param {number} idx
 * @returns {import('../types').Scalar<Dtype>} 
 */
const get_value = (arr, idx) => {
	return '_bytes' in arr ? arr.get(idx) : arr[idx];
}

/**
 * @template {DataType} Dtype
 * @template {import('../types').NdArrayLike<Dtype>} NdArray
 * @template {ArraySelection} Sel
 *
 * @param {import('../types').Setter<Dtype, NdArray>} setter
 * @param {import('../types').Setter<Dtype, NdArray>} setter
 * @param {ZarrArray<Dtype>} arr
 * @param {Sel} selection
 * @param {import('../types').Options} opts
 * @returns {Promise<NdArray | import('../types').Scalar<Dtype>>}
 */
async function get(setter, arr, selection, opts) {
  const indexer = new BasicIndexer({ selection, shape: arr.shape, chunk_shape: arr.chunk_shape });
  // Setup output array
  const outsize = indexer.shape.reduce((a, b) => a * b, 1);
  const out = setter.prepare(
    parse_dtype(arr.dtype).create(outsize),
    indexer.shape,
  );

  const queue = opts.create_queue ? opts.create_queue() : create_queue();

  // iterator over chunks
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    queue.add(() =>
      arr.get_chunk(chunk_coords)
        .then(({ data, shape }) => {
          const chunk = setter.prepare(data, shape);
          setter.set_from_chunk(out, out_selection, chunk, chunk_selection);
        })
        .catch((err) => {
          // re-throw error if not a missing chunk
          if (!(err instanceof KeyError)) throw err;
          // KeyError, we need to fill the corresponding array
          if (arr.fill_value) {
            setter.set_scalar(out, out_selection, arr.fill_value);
          }
        })
    );
  }

  await queue.onIdle();

  // If the final out shape is empty, we just return a scalar.
  return indexer.shape.length === 0 ? get_value(out.data, 0) : out;
}
