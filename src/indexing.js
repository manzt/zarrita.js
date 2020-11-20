import { IndexError, KeyError, ZarrArray, assert } from './core.js';
import { set } from './ops.js';

// This module mutates the ZarrArray prototype to add chunk indexing and slicing

Object.defineProperties(ZarrArray.prototype, {
  get: {
    value(selection) {
      return this.get_basic_selection(selection);
    },
  },
  get_basic_selection: {
    value(selection) {
      const indexer = new _BasicIndexer({ selection, ...this });
      return _get_selection.call(this, indexer);
    },
  },
  set: {
    value(selection, value) {
      return this.set_basic_selection(selection, value);
    },
  },
  set_basic_selection: {
    value(selection, value) {
      const indexer = new _BasicIndexer(selection, this);
      return _set_selection.call(this, indexer, value);
    },
  },
  chunk_size: {
    get() {
      return this.chunk_shape.reduce((a, b) => a * b, 1);
    },
  },
});

// ZarrArray GET

async function _get_selection(indexer) {
  // setup output array
  const outsize = indexer.shape.reduce((a, b) => a * b, 1);
  const out = {
    data: new this.TypedArray(outsize),
    shape: indexer.shape,
    strides: get_strides(indexer.shape),
  };
  // iterator over chunks
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    // TODO: Make concurrent!
    // load chunk selection into output array
    await _chunk_getitem.call(this, chunk_coords, chunk_selection, out, out_selection);
  }
  // Return scalar if no shape ?
  return out.shape ? out : out.data[0];
}

async function _chunk_getitem(chunk_coords, chunk_selection, out, out_selection) {
  try {
    // decode chunk
    const chunk = await this.get_chunk(chunk_coords);
    chunk.strides = get_strides(chunk.shape);
    // store selected data in output
    set(out, out_selection, chunk, chunk_selection);
  } catch (err) {
    if (!(err instanceof KeyError)) {
      throw err;
    }
    if (this.fill_value !== null) {
      set(out, out_selection, this.fill_value);
    }
  }
}

async function _set_selection(indexer, value) {
  // We iterate over all chunks which overlap the selection and thus contain data
  // that needs to be replaced. Each chunk is processed in turn, extracting the
  // necessary data from the value array and storing into the chunk array.

  // N.B., it is an important optimisation that we only visit chunks which overlap
  // the selection. This minimises the number of iterations in the main for loop.

  // determine indices of chunks overlapping the selection
  const sel_shape = indexer.shape;
  // check value shape
  if (sel_shape?.length === 0) {
      assert(_isscalar(value), `value not scalar for scalar selection, got ${value}`);
  }

  // If input is missing strides, compute from array shape
  if (!Array.isArray(value.strides)) {
    // Don't mutate input object
    value = {
      data: value.data,
      shape: value.shape,
      strides: get_strides(value.shape),
    };
  }
  // iterate over chunks in range
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    // put data
    await _chunk_setitem.call(this, chunk_coords, chunk_selection, value, out_selection);
  }
}

async function _chunk_setitem(chunk_coords, chunk_selection, value, out_selection) {
  // obtain key for chunk storage
  const chunk_key = self._chunk_key(chunk_coords);

  let cdata;
  if (_is_total_slice(chunk_selection, this.chunk_shape)) {
    // totally replace chunk

    // optimization: we are completely replacing the chunk, so no need 
    // to access the exisiting chunk data
    if (_isscalar(value)) {
      cdata = new this.TypedArray(this.chunk_size).fill(value);
    }
    // Otherwise data just contiguous TypedArray
    cdata = value.data;
  } else {
    // partially replace the contents of this chunk

    let chunk;
    const strides = get_strides(this.chunk_shape);
    try {
      // decode previous chunk from store
      chunk = await this.get_chunk(chunk_coords);
      chunk.strides = strides;
    } catch (err) {
      if (!(err instanceof KeyError)) {
        throw err;
      }
      chunk = {
        data: this.TypedArray(this.chunk_size),
        shape: this.chunk_shape,
        strides,
      };
      if (typeof this.fill_value === 'number') {
        chunk.data.fill(this.fill_value);
      }
    }

    // Modify chunk data
    if (typeof value === 'number') {
      set(chunk, chunk_selection, value);
    } else {
      set(chunk, chunk_selection, value, out_selection);
    }

    cdata = chunk.data;
  }
  // encode chunk
  const encoded_chunk_data = await this._encode_chunk(cdata);
  // store 
  await this.store.set(chunk_key, encoded_chunk_data);
}

function _isscalar(value) {
  // TODO: better check ?
  return typeof value === 'number';
}

// compute strides for 'C' ordered ndarray from shape
function get_strides(shape) {
  const ndim = shape.length;
  const strides = Array(ndim);
  let step = 1; // init step
  for (let i = ndim - 1; i >= 0; i--) {
    strides[i] = step;
    step *= shape[i];
  }
  return strides;
}

// PYTHON UTILS

// python-like slices
export function slice(start, stop, step = null) {
  assert(start !== undefined, 'Invalid slice. First argumnet must not be undefined.');
  if (stop === undefined) {
    stop = start;
    start = null;
  }
  const indices = size => {
    let [start_ix, end_ix] = [start ?? 0, stop ?? size];
    if (start_ix < 0) start_ix += size;
    if (end_ix < 0) end_ix += size;
    const istep = step ?? 1;
    const len = Math.floor((end_ix - start_ix - 1) / istep + 1);
    return [start_ix, end_ix, istep, len];
  };
  return { start, stop, step, indices, _slice: true };
}

// python-like range generator
function *range(start, stop, step = 1) {
  if (stop == undefined) {
    stop = start;
    start = 0;
  }
  for (let i = start; i < stop; i += step) {
    yield i;
  }
}

// python-like itertools.product generator
function* product(...iterables) {
  if (iterables.length === 0) { return; }
  // make a list of iterators from the iterables
  const iterators = iterables.map(it => it[Symbol.iterator]());
  const results = iterators.map(it => it.next());
  if (results.some(r => r.done)) {
    throw new Error('Input contains an empty iterator.');
  }
  for (let i = 0;;) {
    if (results[i].done) {
      // reset the current iterator
      iterators[i] = iterables[i][Symbol.iterator]();
      results[i] = iterators[i].next();
      // advance, and exit if we've reached the end
      if (++i >= iterators.length) { return; }
    } else {
      yield results.map(({ value }) => value);
      i = 0;
    }
    results[i] = iterators[i].next();
  }
}

function _is_null_slice(s) {
  const { start, stop, step, _slice } = s;
  return _slice && [start, stop, step].every(i => i === null);
}

function _is_total_slice(item, shape) {
  // assume shape is normalized
  if (item === null) return true;
  if (_is_null_slice(item)) return true;
  if (item._slice) item = [item];
  if (Array.isArray(item)) {
    return item.every((s, i) => {
      if (!s._slice) return false; // not a slice
      const full_slice = (s.stop - s.start === shape[i]) && (s.step === 1 || s.step === null);
      return _is_null_slice(s) || full_slice;
    });
  } else {
    throw TypeError(`Expected slice or Array of slices, found: ${JSON.stringify(item)}`);
  }
}

function _err_too_many_indices(selection, shape) {
  throw new IndexError(
    `too many indicies for array; expected ${shape.length}, got ${selection.length}`,
  );
}

function _err_boundscheck(dim_len) {
  throw new IndexError(
    `index out of bounds for dimension with length ${dim_len}`,
  );
}

function _err_negative_step() {
  throw new IndexError('only slices with step >= 1 are supported');
}


function _check_selection_length(selection, shape) {
  if (selection.length > shape.length) {
    _err_too_many_indices(selection, shape);
  }
}

// INDEXING 

function _normalize_integer_selection(dim_sel, dim_len) {
  // normalize type to int
  dim_sel = Math.trunc(dim_sel);
  // handle wraparound
  if (dim_sel < 0) {
    dim_sel = dim_len + dim_sel;
  }
  // handle out of bounds
  if (dim_sel >= dim_len || dim_sel < 0) {
    _err_boundscheck(dim_len);
  }
  return dim_sel;
}


class _IntDimIndexer {
  constructor({ dim_sel, dim_len, dim_chunk_len }) {
    // normalize
    dim_sel = _normalize_integer_selection(dim_sel, dim_len);
    // store properties
    this.dim_sel = dim_sel;
    this.dim_len = dim_len;
    this.dim_chunk_len = dim_chunk_len;
    this.nitems = 1;
  }

  *[Symbol.iterator]() {
    const dim_chunk_ix = Math.floor(this.dim_sel / this.dim_chunk_len);
    const dim_offset = dim_chunk_ix * this.dim_chunk_len;
    const dim_chunk_sel = this.dim_sel - dim_offset;
    const dim_out_sel = this.dim_sel;
    // ChunkDimProjection
    yield { dim_chunk_ix, dim_chunk_sel, dim_out_sel };
  }
}

class _SliceDimIndexer {

  constructor({ dim_sel, dim_len, dim_chunk_len }) {
    // normalize
    const [start, stop, step] = dim_sel.indices(dim_len);
    this.start = start;
    this.stop = stop;
    this.step = step;
    if (this.step < 1) _err_negative_step();
    // store properties
    this.dim_len = dim_len;
    this.dim_chunk_len = dim_chunk_len;
    this.nitems = Math.max(0, Math.ceil((this.stop - this.start) / this.step));
    this.nchunks = Math.ceil(this.dim_len / this.dim_chunk_len);
  }

  *[Symbol.iterator]() {
    // figure out the range of chunks we need to visit
    const dim_chunk_ix_from = Math.floor(this.start / this.dim_chunk_len);
    const dim_chunk_ix_to = Math.ceil(this.stop / this.dim_chunk_len);
    for (const dim_chunk_ix of range(dim_chunk_ix_from, dim_chunk_ix_to)) {
      // compute offsets for chunk within overall array
      const dim_offset = dim_chunk_ix * this.dim_chunk_len;
      const dim_limit = Math.min(this.dim_len, (dim_chunk_ix + 1) * this.dim_chunk_len);
      // determine chunk length, accounting for trailing chunk
      const dim_chunk_len = dim_limit - dim_offset;

      let dim_out_offset = 0;
      let dim_chunk_sel_start = 0;
      if (this.start < dim_offset) {
        // selection start before current chunk
        const remainder = (dim_offset - this.start) % this.step;
        if (remainder) dim_chunk_sel_start += this.step - remainder;
        // compute number of previous items, provides offset into output array
        dim_out_offset = Math.ceil((dim_offset - this.start) / this.step);
      } else {
        // selection starts within current chunk
        dim_chunk_sel_start = this.start - dim_offset;
      }
      // selection starts within current chunk if true, 
      // otherwise selection ends after current chunk.
      const dim_chunk_sel_stop = this.stop > dim_limit ? dim_chunk_len : this.stop - dim_offset;

      const dim_chunk_sel = slice(dim_chunk_sel_start, dim_chunk_sel_stop, this.step);
      const dim_chunk_nitems = Math.ceil((dim_chunk_sel_stop - dim_chunk_sel_start) / this.step);
      const dim_out_sel = slice(dim_out_offset, dim_out_offset + dim_chunk_nitems, 1);
      // ChunkDimProjection      
      yield { dim_chunk_ix, dim_chunk_sel, dim_out_sel };
    }
  }
}

function _normalize_selection(selection, shape) {
  if (selection === null) {
    // eslint-disable-next-line no-unused-vars
    selection = shape.map(_ => slice(null));
  } else if (Array.isArray(selection)) {
    selection = selection.map(s => s ?? slice(null));
  }
  _check_selection_length(selection, shape);
  return selection;
}


class _BasicIndexer {
  constructor({ selection, shape, chunk_shape }) {
    // handle normalize selection 
    selection = _normalize_selection(selection, shape);
    
    // setup per-dimension indexers
    this.dim_indexers = selection.map((dim_sel, i) => {
      const config = { dim_sel, dim_len: shape[i], dim_chunk_len: chunk_shape[i] };
      if (typeof dim_sel === 'number') {
        return new _IntDimIndexer(config);
      } else if (dim_sel._slice) {
        return new _SliceDimIndexer(config);
      }
      throw IndexError(
        `unsupported selection item for basic indexing; 
        expected integer or slice, got ${JSON.stringify(dim_sel)}`,
      );
    });
    this.shape = this.dim_indexers
      .filter(ixr => !(ixr instanceof _IntDimIndexer))
      .map(sixr => sixr.nitems);
    
  }
  *[Symbol.iterator]() {
    for (const dim_projections of product(...this.dim_indexers)) {
      const chunk_coords = dim_projections.map(p => p.dim_chunk_ix);
      const chunk_selection = dim_projections.map(p => p.dim_chunk_sel);
      const out_selection = dim_projections.map(p => p.dim_out_sel);
      yield { chunk_coords, chunk_selection, out_selection };
    }
  }
}
