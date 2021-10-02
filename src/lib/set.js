// @ts-check
import { assert, KeyError } from './errors.js';
import { get_strides, parse_dtype, slice } from './util.js';
import { set_from_chunk, set_scalar } from './ops.js';
import { BasicIndexer, is_total_slice } from './indexing.js';

/** @typedef {import('../types').DataType} DataType */
/** @typedef {import('../types').ArraySelection} ArraySelection */
/**
 * @template {DataType} Dtype
 * @typedef {import('../types').TypedArray<Dtype>} TypedArray
 */
/** @typedef {import('../types').Slice} Slice */
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
 * @param {ArraySelection} selection
 * @param {NDArray<Dtype> | Scalar<Dtype>} value
 * @returns {Promise<void>}
 */
export function set(selection, value) {
  const indexer = new BasicIndexer({ selection, ...this });
  return set_selection.call(this, indexer, value);
}

/**
 * @template {DataType} Dtype
 * @this {ZarrArray<Dtype>}
 *
 * @param {BasicIndexer} indexer
 * @param {NDArray<Dtype> | Scalar<Dtype>} value
 */
async function set_selection(indexer, value) {
  // We iterate over all chunks which overlap the selection and thus contain data
  // that needs to be replaced. Each chunk is processed in turn, extracting the
  // necessary data from the value array and storing into the chunk array.

  // N.B., it is an important optimisation that we only visit chunks which overlap
  // the selection. This minimises the number of iterations in the main for loop.

  // determine indices of chunks overlapping the selection check value shape
  if (indexer.shape.length === 0) {
    assert(
      typeof value !== 'object',
      `value not scalar for scalar selection, got ${value}`,
    );
  }

  const v = typeof value === 'object' ? { stride: get_strides(value.shape), ...value } : value;

  // iterate over chunks in range
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    await chunk_setitem.call(
      this,
      chunk_coords,
      chunk_selection,
      v,
      out_selection,
    );
  }
}

/**
 * @template {DataType} Dtype
 * @this {ZarrArray<Dtype>}
 * @param {number[]} chunk_coords
 * @param {(number | Slice)[]} chunk_selection
 * @param {Scalar<Dtype> | NDArray<Dtype>} value
 * @param {(null | number | Slice)[]} out_selection
 */
async function chunk_setitem(chunk_coords, chunk_selection, value, out_selection) {
  // obtain key for chunk storage
  const chunk_key = this.chunk_key(chunk_coords);
  const chunk_size = this.chunk_shape.reduce((a, b) => a * b, 1);
  const chunk_stride = get_strides(this.chunk_shape);

  const { create } = parse_dtype(this.dtype);

  /** @type {TypedArray<Dtype>} */
  let cdata;

  if (is_total_slice(chunk_selection, this.chunk_shape)) {
    // totally replace chunk

    // optimization: we are completely replacing the chunk, so no need
    // to access the exisiting chunk data
    if (typeof value === 'object') {
      // Otherwise data just contiguous TypedArray
      const chunk = {
        data: /** @type {TypedArray<Dtype>} */ (create(chunk_size)),
        shape: this.chunk_shape,
        stride: chunk_stride,
      };
      const full_selection = this.chunk_shape.map(() => slice(null));
      set_from_chunk(chunk, full_selection, value, out_selection);
      cdata = chunk.data;
    } else {
      cdata = /** @type {TypedArray<Dtype>} */ (create(chunk_size).fill(
        value,
      ));
    }
  } else {
    // partially replace the contents of this chunk
    /** @type {NDArray<Dtype>} */
    let chunk;
    try {
      // decode previous chunk from store
      const { data, shape } = await this.get_chunk(chunk_coords);
      chunk = { data, shape, stride: chunk_stride };
    } catch (err) {
      if (!(err instanceof KeyError)) {
        throw err;
      }
      chunk = {
        data: /** @type {TypedArray<Dtype>} */ (create(chunk_size)),
        shape: this.chunk_shape,
        stride: chunk_stride,
      };
      if (typeof this.fill_value === 'number') {
        chunk.data.fill(this.fill_value);
      }
    }

    // Modify chunk data
    if (typeof value === 'object') {
      set_from_chunk(chunk, chunk_selection, value, out_selection);
    } else {
      set_scalar(chunk, chunk_selection, value);
    }

    cdata = chunk.data;
  }
  // encode chunk
  const encoded_chunk_data = await this._encode_chunk(cdata);
  // store
  await this.store.set(chunk_key, encoded_chunk_data);
}
