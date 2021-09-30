// @ts-check
import { assert, IndexError, KeyError } from './errors.js';
import { set_from_chunk, set_scalar } from './ops.js';
import { parse_dtype } from './util.js';

/** @typedef {import('../types').DataType} DataType */
/** @typedef {import('../types').Store} Store */
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
 * @template {Store} S
 * @typedef {import('../hierarchy').ZarrArray<Dtype, S>} ZarrArray
 */

/**
 * @template {DataType} Dtype
 *
 * @this {ZarrArray<Dtype, Store>}
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
 * @this {ZarrArray<Dtype, Store>}
 * @param {number[]} chunk_coords
 * @param {(number | Slice)[]} chunk_selection
 * @param {NDArray<Dtype>} out
 * @param {(null | number | Slice)[]} out_selection
 */
async function chunk_getitem(
  chunk_coords,
  chunk_selection,
  out,
  out_selection,
) {
  return this.get_chunk(chunk_coords).then(({ data, shape }) => {
    const chunk = { data, shape, stride: get_strides(shape) };
    set_from_chunk(out, out_selection, chunk, chunk_selection);
  }).catch((err) => {
    // re-throw error if not a missing chunk
    if (!(err instanceof KeyError)) throw err;
    if (this.fill_value) set_scalar(out, out_selection, this.fill_value);
  });
}

/**
 * @template {DataType} Dtype
 *
 * @this {ZarrArray<Dtype, unknown>}
 * @param {BasicIndexer} indexer
 * @param {Scalar<Dtype> | NDArray<Dtype> | Omit<NDArray<Dtype>, 'stride'>} value
 */
export async function set_selection(indexer, value) {
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

  const v = typeof value === 'object'
    ? { stride: get_strides(value.shape), ...value }
    : value;

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
 * @this {ZarrArray<Dtype, Store>}
 * @param {number[]} chunk_coords
 * @param {(number | Slice)[]} chunk_selection
 * @param {Scalar<Dtype> | NDArray<Dtype>} value
 * @param {(null | number | Slice)[]} out_selection
 */
async function chunk_setitem(
  chunk_coords,
  chunk_selection,
  value,
  out_selection,
) {
  // obtain key for chunk storage
  const chunk_key = this._chunk_key(chunk_coords);
  const chunk_size = this.chunk_shape.reduce((a, b) => a * b, 1);
  const chunk_stride = get_strides(this.chunk_shape);

  const { ctr } = parse_dtype(this.dtype);

  /** @type {TypedArray<Dtype>} */
  let cdata;

  if (is_total_slice(chunk_selection, this.chunk_shape)) {
    // totally replace chunk

    // optimization: we are completely replacing the chunk, so no need
    // to access the exisiting chunk data
    if (typeof value === 'object') {
      // Otherwise data just contiguous TypedArray
      const chunk = {
        data: /** @type {TypedArray<Dtype>} */ (new ctr(chunk_size)),
        shape: this.chunk_shape,
        stride: chunk_stride,
      };
      const full_selection = this.chunk_shape.map(() => slice(null));
      set_from_chunk(chunk, full_selection, value, out_selection);
      cdata = chunk.data;
    } else {
      cdata = /** @type {TypedArray<Dtype>} */ (new ctr(chunk_size).fill(value));
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
        data: /** @type {TypedArray<Dtype>} */ (new ctr(chunk_size)),
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

/**
 * Compute strides for 'C' ordered ndarray from shape
 *
 * @param {number[]} shape
 */
function get_strides(shape) {
  const ndim = shape.length;
  /** @type {number[]} */
  const strides = Array(ndim);
  let step = 1; // init step
  for (let i = ndim - 1; i >= 0; i--) {
    strides[i] = step;
    step *= shape[i];
  }
  return strides;
}

// PYTHON UTILS

/**
 * @param {number | null} start
 * @param {(number | null)=} stop
 * @param {(number | null)=} step
 * @return {Slice}
 */
export function slice(start, stop, step = null) {
  if (stop === undefined) {
    stop = start;
    start = null;
  }
  /** @type {(length: number) => import('../types').Indices} */
  const indices = (length) => {
    assert(
      typeof length === 'number',
      'must provide sized length for slice indices.',
    );
    const istep = step ?? 1;
    let start_ix = start ?? (istep < 0 ? length - 1 : 0);
    let end_ix = stop ?? (istep < 0 ? -1 : length);
    if (start_ix < 0) start_ix += length;
    if (end_ix < 0) end_ix += length;
    return [start_ix, end_ix, istep];
  };
  return { start, stop, step, indices, kind: 'slice' };
}

/**
 * python-like range generator
 * @param {number} start
 * @param {number=} stop
 * @param {number=} step
 */
function* range(start, stop, step = 1) {
  if (stop == undefined) {
    stop = start;
    start = 0;
  }
  for (let i = start; i < stop; i += step) {
    yield i;
  }
}

/**
 * python-like itertools.product generator
 * https://gist.github.com/cybercase/db7dde901d7070c98c48
 *
 * @template {Array<Iterable<any>>} T
 * @param {T} iterables
 * @returns {IterableIterator<{ [K in keyof T]: T[K] extends Iterable<infer U> ? U : never}>}
 */
function* product(...iterables) {
  if (iterables.length === 0) {
    return;
  }
  // make a list of iterators from the iterables
  const iterators = iterables.map((it) => it[Symbol.iterator]());
  const results = iterators.map((it) => it.next());
  if (results.some((r) => r.done)) {
    throw new Error('Input contains an empty iterator.');
  }
  for (let i = 0;;) {
    if (results[i].done) {
      // reset the current iterator
      iterators[i] = iterables[i][Symbol.iterator]();
      results[i] = iterators[i].next();
      // advance, and exit if we've reached the end
      if (++i >= iterators.length) {
        return;
      }
    } else {
      yield /** @type {any} */ (results.map(({ value }) => value));
      i = 0;
    }
    results[i] = iterators[i].next();
  }
}

/**
 * @param {(null | number | Slice)[]} item
 * @param {number[]} shape
 * @returns {boolean}
 */
function is_total_slice(item, shape) {
  for (const [i, s] of item.entries()) {
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

/**
 * @param {(number | Slice)[]} selection
 * @param {number[]} shape
 */
function err_too_many_indices(selection, shape) {
  throw new IndexError(
    `too many indicies for array; expected ${shape.length}, got ${selection.length}`,
  );
}

/** @param {number} dim_len */
function err_boundscheck(dim_len) {
  throw new IndexError(
    `index out of bounds for dimension with length ${dim_len}`,
  );
}

function err_negative_step() {
  throw new IndexError('only slices with step >= 1 are supported');
}

/**
 * @param {(number | Slice)[]} selection
 * @param {number[]} shape
 */
function check_selection_length(selection, shape) {
  if (selection.length > shape.length) {
    err_too_many_indices(selection, shape);
  }
}

// INDEXING

/**
 * @param {number} dim_sel
 * @param {number} dim_len
 */
function normalize_integer_selection(dim_sel, dim_len) {
  // normalize type to int
  dim_sel = Math.trunc(dim_sel);
  // handle wraparound
  if (dim_sel < 0) {
    dim_sel = dim_len + dim_sel;
  }
  // handle out of bounds
  if (dim_sel >= dim_len || dim_sel < 0) {
    err_boundscheck(dim_len);
  }
  return dim_sel;
}

/** @typedef {{ dim_chunk_ix: number, dim_chunk_sel: number | Slice, dim_out_sel: number | Slice | null }} ChunkDimProjection */

class IntDimIndexer {
  /** @param {{ dim_sel: number, dim_len: number, dim_chunk_len: number }} props */
  constructor({ dim_sel, dim_len, dim_chunk_len }) {
    // normalize
    dim_sel = normalize_integer_selection(dim_sel, dim_len);
    // store properties
    this.dim_sel = dim_sel;
    this.dim_len = dim_len;
    this.dim_chunk_len = dim_chunk_len;
    this.nitems = 1;
  }

  /** @returns {IterableIterator<ChunkDimProjection>} */
  *[Symbol.iterator]() {
    const dim_chunk_ix = Math.floor(this.dim_sel / this.dim_chunk_len);
    const dim_offset = dim_chunk_ix * this.dim_chunk_len;
    const dim_chunk_sel = this.dim_sel - dim_offset;
    const dim_out_sel = null;
    yield { dim_chunk_ix, dim_chunk_sel, dim_out_sel };
  }
}

class SliceDimIndexer {
  /** @param {{ dim_sel: Slice, dim_len: number, dim_chunk_len: number }} props */
  constructor({ dim_sel, dim_len, dim_chunk_len }) {
    // normalize
    const [start, stop, step] = dim_sel.indices(dim_len);
    this.start = start;
    this.stop = stop;
    this.step = step;
    if (this.step < 1) err_negative_step();
    // store properties
    this.dim_len = dim_len;
    this.dim_chunk_len = dim_chunk_len;
    this.nitems = Math.max(
      0,
      Math.ceil((this.stop - this.start) / this.step),
    );
    this.nchunks = Math.ceil(this.dim_len / this.dim_chunk_len);
  }

  /** @returns {IterableIterator<ChunkDimProjection>} */
  *[Symbol.iterator]() {
    // figure out the range of chunks we need to visit
    const dim_chunk_ix_from = Math.floor(this.start / this.dim_chunk_len);
    const dim_chunk_ix_to = Math.ceil(this.stop / this.dim_chunk_len);
    for (const dim_chunk_ix of range(dim_chunk_ix_from, dim_chunk_ix_to)) {
      // compute offsets for chunk within overall array
      const dim_offset = dim_chunk_ix * this.dim_chunk_len;
      const dim_limit = Math.min(
        this.dim_len,
        (dim_chunk_ix + 1) * this.dim_chunk_len,
      );
      // determine chunk length, accounting for trailing chunk
      const dim_chunk_len = dim_limit - dim_offset;

      let dim_out_offset = 0;
      let dim_chunk_sel_start = 0;
      if (this.start < dim_offset) {
        // selection start before current chunk
        const remainder = (dim_offset - this.start) % this.step;
        if (remainder) dim_chunk_sel_start += this.step - remainder;
        // compute number of previous items, provides offset into output array
        dim_out_offset = Math.ceil(
          (dim_offset - this.start) / this.step,
        );
      } else {
        // selection starts within current chunk
        dim_chunk_sel_start = this.start - dim_offset;
      }
      // selection starts within current chunk if true,
      // otherwise selection ends after current chunk.
      const dim_chunk_sel_stop = this.stop > dim_limit
        ? dim_chunk_len
        : this.stop - dim_offset;

      const dim_chunk_sel = slice(
        dim_chunk_sel_start,
        dim_chunk_sel_stop,
        this.step,
      );
      const dim_chunk_nitems = Math.ceil(
        (dim_chunk_sel_stop - dim_chunk_sel_start) / this.step,
      );
      const dim_out_sel = slice(
        dim_out_offset,
        dim_out_offset + dim_chunk_nitems,
        1,
      );
      // ChunkDimProjection
      yield { dim_chunk_ix, dim_chunk_sel, dim_out_sel };
    }
  }
}

/**
 * @param {null | (Slice | null | number)[]} selection
 * @param {number[]} shape
 * @returns {(number | Slice)[]}
 */
function normalize_selection(selection, shape) {
  /** @type {(number | Slice)[]} */
  let normalized = [];
  if (selection === null) {
    normalized = shape.map((_) => slice(null));
  } else if (Array.isArray(selection)) {
    normalized = selection.map((s) => s ?? slice(null));
  }
  check_selection_length(normalized, shape);
  return normalized;
}

export class BasicIndexer {
  /**
   * @param {{
   *  selection: null | (null | number | Slice)[];
   *  shape: number[];
   *  chunk_shape: number[];
   *  }} props
   */
  constructor({ selection, shape, chunk_shape }) {
    // handle normalize selection
    selection = normalize_selection(selection, shape);

    // setup per-dimension indexers
    this.dim_indexers = selection.map((dim_sel, i) => {
      if (typeof dim_sel === 'number') {
        return new IntDimIndexer({
          dim_sel,
          dim_len: shape[i],
          dim_chunk_len: chunk_shape[i],
        });
      } else if (dim_sel?.kind === 'slice') {
        return new SliceDimIndexer({
          dim_sel,
          dim_len: shape[i],
          dim_chunk_len: chunk_shape[i],
        });
      }
      throw new IndexError(
        `unsupported selection item for basic indexing; expected integer or slice, got ${
          JSON.stringify(dim_sel)
        }`,
      );
    });
    this.shape = this.dim_indexers.filter((ixr) => !(ixr instanceof IntDimIndexer)).map((
      sixr,
    ) => sixr.nitems);
  }

  *[Symbol.iterator]() {
    for (const dim_projections of product(...this.dim_indexers)) {
      const chunk_coords = dim_projections.map((p) => p.dim_chunk_ix);
      const chunk_selection = dim_projections.map((p) => p.dim_chunk_sel);
      const out_selection = dim_projections.map((p) => p.dim_out_sel);
      yield { chunk_coords, chunk_selection, out_selection };
    }
  }
}
