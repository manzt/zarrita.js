// @ts-check
import { KeyError } from './errors.js';
import { BasicIndexer } from './indexing.js';
import { parse_dtype } from './util.js';
import { setter } from '../ndarray.js';

/** @typedef {import('../types').DataType} DataType */
/** @typedef {import('../types').ArraySelection} ArraySelection */
/**
 * @template {DataType} Dtype
 * @typedef {import('../types').Scalar<Dtype>} Scalar
 */
/**
 * @template {DataType} Dtype
 * @typedef {import('../types').NDArray<Dtype>} NDArray
 */
/**
 * @template {DataType} Dtype
 * @typedef {import('../hierarchy').ZarrArray<Dtype, import('../types').Store>} ZarrArray
 */

/**
 * @template {DataType} Dtype
 * @this {ZarrArray<Dtype>}
 *
 * @template {ArraySelection} Sel
 * @param {Sel} selection
 */
export function get(selection) {
  return get_selection(this, selection, setter);
}

function register(func, setter) {

}

/**
 * @template {DataType} Dtype
 * @template {NDArray<Dtype>} Container
 * @template {ArraySelection} Sel
 *
 * @param {ZarrArray<Dtype>} arr
 * @param {Sel} selection
 * @param {import('../types').Setter<Dtype, Container>} setter
 * @returns {Promise<Container | Scalar<Dtype>>}
 */
async function get_selection(arr, selection, setter) {
  const indexer = new BasicIndexer({ selection, shape: arr.shape, chunk_shape: arr.chunk_shape });
  // Setup output array
  const outsize = indexer.shape.reduce((a, b) => a * b, 1);
  const out = setter.prepare(
    parse_dtype(arr.dtype).create(outsize),
    indexer.dim_indexers.map((ixr) => ixr.nitems), // un-squeezed shape
  );

  // iterator over chunks
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    // TODO: make concurrent
    await arr.get_chunk(chunk_coords)
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
      });
  }

  // If the final out shape is empty, we just return a scalar.
  return indexer.shape.length === 0 ? out.data[0] : setter.prepare(out.data, indexer.shape);
}
