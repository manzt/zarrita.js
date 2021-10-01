// @ts-check
import { KeyError } from './lib/errors.js';
import { BasicIndexer } from './lib/indexing.js';
import { set_from_chunk, set_scalar } from './lib/ops.js';
import { get_strides, parse_dtype } from './lib/util.js';

/** @typedef {import('./types').DataType} DataType */
/**
 * @template {DataType} Dtype
 * @typedef {import('./types').TypedArray<Dtype>} TypedArray
 */
/** @typedef {import('./types').Slice} Slice */
/**
 * @template {DataType} Dtype
 * @typedef {import('./types').Scalar<Dtype>} Scalar
 */
/**
 * @template {DataType} Dtype
 * @typedef {import('./types').NDArray<Dtype>} NDArray
 */
/**
 * @template {DataType} Dtype
 * @typedef {import('./hierarchy').ZarrArray<Dtype, import('./types').Store>} ZarrArray
 */

/**
 * @template {DataType} Dtype
 * @this {ZarrArray<Dtype>}
 *
 * @template {null | (number | import('./types').Slice | null)[]} S
 * @param {S} selection */
export function get(selection) {
  const indexer = new BasicIndexer({ selection, ...this });
  return get_selection.call(this, indexer);
}

/**
 * @template {DataType} Dtype
 *
 * @this {ZarrArray<Dtype>}
 * @param {BasicIndexer} indexer
 * @returns {Promise<NDArray<Dtype> | Scalar<Dtype>>}
 */
export async function get_selection(indexer) {
  // Setup output array
  const unsqueezed_shape = indexer.dim_indexers.map((ixr) => ixr.nitems);
  const outsize = unsqueezed_shape.reduce((a, b) => a * b, 1);

  const { create } = parse_dtype(this.dtype);

  const out = {
    data: create(outsize),
    shape: unsqueezed_shape,
    stride: get_strides(unsqueezed_shape),
  };

  // iterator over chunks
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    // TODO: Make concurrent!
    // load chunk selection into output array
    await chunk_getitem.call(
      this,
      chunk_coords,
      chunk_selection,
      out,
      out_selection,
    );
  }

  // Finally, we "squeeze" the output array shape/strides by using the indexer shape.
  // This removes dimensions which have size 1 and were indexed by integer.
  out.shape = indexer.shape;
  out.stride = get_strides(indexer.shape);

  // If the final out shape is empty, we just return a scalar.
  return out.shape.length === 0 ? out.data[0] : out;
}

/**
 * @function
 * @template {DataType} Dtype
 * @this {ZarrArray<Dtype>}
 * @param {number[]} chunk_coords
 * @param {(number | Slice)[]} chunk_selection
 * @param {NDArray<Dtype>} out
 * @param {(null | number | Slice)[]} out_selection
 */
async function chunk_getitem(chunk_coords, chunk_selection, out, out_selection) {
  return this.get_chunk(chunk_coords).then(({ data, shape }) => {
    const chunk = { data, shape, stride: get_strides(shape) };
    set_from_chunk(out, out_selection, chunk, chunk_selection);
  }).catch((err) => {
    // re-throw error if not a missing chunk
    if (!(err instanceof KeyError)) throw err;
    if (this.fill_value) set_scalar(out, out_selection, this.fill_value);
  });
}
