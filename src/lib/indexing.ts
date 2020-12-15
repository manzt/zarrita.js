import { IndexError, assert } from './errors.js';
import { set } from './ops.js';
import type { ZarrArray, TypedArray, Slice, Indices, NDArray } from '../core.js';

// ZarrArray GET
export async function _get_selection(this: ZarrArray, indexer: _BasicIndexer): Promise<number | NDArray> {
  // Setup output array
  const unsqueezed_shape = indexer.dim_indexers.map(ixr => ixr.nitems);
  const outsize = unsqueezed_shape.reduce((a, b) => a * b, 1);
  const out: NDArray = {
    data: new (this.TypedArray as any)(outsize) as TypedArray,
    shape: unsqueezed_shape,
    stride: get_strides(unsqueezed_shape),
  };
  // iterator over chunks
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    // TODO: Make concurrent!
    // load chunk selection into output array
    await _chunk_getitem.call(this, chunk_coords, chunk_selection, out, out_selection);
  }
  // Finally, we "squeeze" the output array shape/strides by using the indexer shape.
  // This removes dimensions which have size 1 and were indexed by integer.
  out.shape = indexer.shape;
  out.stride = get_strides(indexer.shape);
  // If the final out shape is empty, we just return a scalar.
  return out.shape.length === 0 ? out.data[0] : out;
}

async function _chunk_getitem(
  this: ZarrArray,
  chunk_coords: number[],
  chunk_selection: (number | Slice)[],
  out: NDArray,
  out_selection: (null | number | Slice)[]
) {
  const res = await this.get_chunk(chunk_coords);
  if (res) {
    const { data, shape } = res;
    const chunk: NDArray = { data, shape, stride: get_strides(shape) };
    set(out, out_selection, chunk, chunk_selection);
  } else if (this.fill_value) {
    // fill missing chunk with fill_value if fill_value isn't falsy
    set(out, out_selection, this.fill_value);
  }
}

export async function _set_selection(this: ZarrArray, indexer: _BasicIndexer, value: number | NDArray) {
  // We iterate over all chunks which overlap the selection and thus contain data
  // that needs to be replaced. Each chunk is processed in turn, extracting the
  // necessary data from the value array and storing into the chunk array.

  // N.B., it is an important optimisation that we only visit chunks which overlap
  // the selection. This minimises the number of iterations in the main for loop.

  // determine indices of chunks overlapping the selection
  // check value shape
  if (indexer.shape.length === 0) {
    assert(typeof value === 'number', `value not scalar for scalar selection, got ${value}`);
  }

  if ((<NDArray>value).data && (<NDArray>value).shape && !(<NDArray>value).stride) {
    // If input is missing strides, compute from array shape
    value = {
      data: (<NDArray>value).data,
      shape: (<NDArray>value).shape,
      stride: get_strides((<NDArray>value).shape),
    };
  }

  if (!(typeof value === 'number')) {
    assert(
      value.data instanceof (this.TypedArray as any),
      `Incorrect dtype, tried to assign ${value.data.constructor.name} to ${this.dtype} (${this.TypedArray.constructor.name}).`
    );
  }

  // iterate over chunks in range
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    await _chunk_setitem.call(this, chunk_coords, chunk_selection, value, out_selection);
  }
}

async function _chunk_setitem(
  this: ZarrArray,
  chunk_coords: number[],
  chunk_selection: (number | Slice)[],
  value: number | NDArray,
  out_selection: (null | number | Slice)[]
) {
  // obtain key for chunk storage
  const chunk_key = this._chunk_key(chunk_coords);
  const chunk_size = this.chunk_shape.reduce((a, b) => a * b, 1);
  const chunk_stride = get_strides(this.chunk_shape);
  let cdata;
  if (_is_total_slice(chunk_selection, this.chunk_shape)) {
    // totally replace chunk

    // optimization: we are completely replacing the chunk, so no need
    // to access the exisiting chunk data
    if (typeof value === 'number') {
      cdata = new (this.TypedArray as any)(chunk_size).fill(value) as TypedArray;
    } else {
      // Otherwise data just contiguous TypedArray
      const chunk = {
        data: new (this.TypedArray as any)(chunk_size) as TypedArray,
        shape: this.chunk_shape,
        stride: chunk_stride,
      };
      const full_selection = this.chunk_shape.map(() => slice(null));
      set(chunk, full_selection, value, out_selection);
      cdata = chunk.data;
    }
  } else {
    // partially replace the contents of this chunk
    let chunk: NDArray;
    const res = await this.get_chunk(chunk_coords);
    if (res) {
      // decode previous chunk from store
      const { data, shape } = res;
      chunk = { data, shape, stride: chunk_stride };
    } else {
      chunk = {
        data: new (this.TypedArray as any)(chunk_size) as TypedArray,
        shape: this.chunk_shape,
        stride: chunk_stride,
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

// compute strides for 'C' ordered ndarray from shape
function get_strides(shape: number[]): number[] {
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
export function slice(start: number | null, stop?: null | number, step: null | number = null): Slice {
  assert(start !== undefined, 'Invalid slice. First argumnet must not be undefined.');
  if (stop === undefined) {
    stop = start;
    start = null;
  }
  const indices = (length: number): Indices => {
    assert(typeof length === 'number', 'must provide sized length for slice indices.');
    const istep = step ?? 1;
    let start_ix = start ?? (istep < 0 ? length - 1 : 0);
    let end_ix = stop ?? (istep < 0 ? -1 : length);
    if (start_ix < 0) start_ix += length;
    if (end_ix < 0) end_ix += length;
    return [start_ix, end_ix, istep];
  };
  return { start, stop, step, indices, _slice: true };
}

// python-like range generator
function* range(start: number, stop?: number, step = 1): Generator<number> {
  if (stop == undefined) {
    stop = start;
    start = 0;
  }
  for (let i = start; i < stop; i += step) {
    yield i;
  }
}

// python-like itertools.product generator
// https://gist.github.com/cybercase/db7dde901d7070c98c48
function* product<T extends Array<Iterable<any>>>(
  ...iterables: T
): IterableIterator<
  {
    [K in keyof T]: T[K] extends Iterable<infer U> ? U : never;
  }
> {
  if (iterables.length === 0) {
    return;
  }
  // make a list of iterators from the iterables
  const iterators = iterables.map(it => it[Symbol.iterator]());
  const results = iterators.map(it => it.next());
  if (results.some(r => r.done)) {
    throw new Error('Input contains an empty iterator.');
  }
  for (let i = 0; ; ) {
    if (results[i].done) {
      // reset the current iterator
      iterators[i] = iterables[i][Symbol.iterator]();
      results[i] = iterators[i].next();
      // advance, and exit if we've reached the end
      if (++i >= iterators.length) {
        return;
      }
    } else {
      yield results.map(({ value }) => value) as any;
      i = 0;
    }
    results[i] = iterators[i].next();
  }
}

function _is_total_slice(item: (null | number | Slice)[], shape: number[]): boolean {
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

function _err_too_many_indices(selection: (number | Slice)[], shape: number[]) {
  throw new IndexError(`too many indicies for array; expected ${shape.length}, got ${selection.length}`);
}

function _err_boundscheck(dim_len: number) {
  throw new IndexError(`index out of bounds for dimension with length ${dim_len}`);
}

function _err_negative_step() {
  throw new IndexError('only slices with step >= 1 are supported');
}

function _check_selection_length(selection: (number | Slice)[], shape: number[]) {
  if (selection.length > shape.length) {
    _err_too_many_indices(selection, shape);
  }
}

// INDEXING

function _normalize_integer_selection(dim_sel: number, dim_len: number) {
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
  dim_sel: number;
  dim_len: number;
  dim_chunk_len: number;
  nitems: number;

  constructor({ dim_sel, dim_len, dim_chunk_len }: { dim_sel: number; dim_len: number; dim_chunk_len: number }) {
    // normalize
    dim_sel = _normalize_integer_selection(dim_sel, dim_len);
    // store properties
    this.dim_sel = dim_sel;
    this.dim_len = dim_len;
    this.dim_chunk_len = dim_chunk_len;
    this.nitems = 1;
  }

  *[Symbol.iterator](): IterableIterator<_ChunkDimProjection> {
    const dim_chunk_ix = Math.floor(this.dim_sel / this.dim_chunk_len);
    const dim_offset = dim_chunk_ix * this.dim_chunk_len;
    const dim_chunk_sel = this.dim_sel - dim_offset;
    const dim_out_sel = null;
    yield { dim_chunk_ix, dim_chunk_sel, dim_out_sel };
  }
}

interface _ChunkDimProjection {
  dim_chunk_ix: number;
  dim_chunk_sel: number | Slice;
  dim_out_sel: null | number | Slice;
}

class _SliceDimIndexer {
  start: number;
  stop: number;
  step: number;
  dim_len: number;
  dim_chunk_len: number;
  nitems: number;
  nchunks: number;

  constructor({ dim_sel, dim_len, dim_chunk_len }: { dim_sel: Slice; dim_len: number; dim_chunk_len: number }) {
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

  *[Symbol.iterator](): IterableIterator<_ChunkDimProjection> {
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

function _normalize_selection(selection: null | (Slice | null | number)[], shape: number[]): (number | Slice)[] {
  let normalized: (number | Slice)[] = [];
  if (selection === null) {
    normalized = shape.map(_ => slice(null));
  } else if (Array.isArray(selection)) {
    normalized = selection.map(s => s ?? slice(null));
  }
  _check_selection_length(normalized, shape);
  return normalized;
}

export class _BasicIndexer {
  dim_indexers: (_IntDimIndexer | _SliceDimIndexer)[];
  shape: number[];

  constructor({
    selection,
    shape,
    chunk_shape,
  }: {
    selection: null | (null | number | Slice)[];
    shape: number[];
    chunk_shape: number[];
  }) {
    // handle normalize selection
    selection = _normalize_selection(selection, shape);

    // setup per-dimension indexers
    this.dim_indexers = selection.map((dim_sel, i) => {
      if (typeof dim_sel === 'number') {
        return new _IntDimIndexer({ dim_sel, dim_len: shape[i], dim_chunk_len: chunk_shape[i] });
      } else if ((dim_sel as Slice)._slice) {
        return new _SliceDimIndexer({ dim_sel: dim_sel as Slice, dim_len: shape[i], dim_chunk_len: chunk_shape[i] });
      }
      throw new IndexError(
        `unsupported selection item for basic indexing; expected integer or slice, got ${JSON.stringify(dim_sel)}`
      );
    });
    this.shape = this.dim_indexers.filter(ixr => !(ixr instanceof _IntDimIndexer)).map(sixr => sixr.nitems);
  }
  *[Symbol.iterator](): IterableIterator<{
    chunk_coords: number[];
    chunk_selection: (number | Slice)[];
    out_selection: (null | number | Slice)[];
  }> {
    for (const dim_projections of product(...this.dim_indexers)) {
      const chunk_coords = dim_projections.map(p => p.dim_chunk_ix);
      const chunk_selection = dim_projections.map(p => p.dim_chunk_sel);
      const out_selection = dim_projections.map(p => p.dim_out_sel);
      yield { chunk_coords, chunk_selection, out_selection };
    }
  }
}
