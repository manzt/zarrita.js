import type { ZarrArray, Slice, NDArray } from '../core.js';
export declare function _get_selection(this: ZarrArray, indexer: _BasicIndexer): Promise<number | NDArray>;
export declare function _set_selection(this: ZarrArray, indexer: _BasicIndexer, value: number | NDArray): Promise<void>;
export declare function slice(start: number | null, stop?: null | number, step?: null | number): Slice;
declare class _IntDimIndexer {
    dim_sel: number;
    dim_len: number;
    dim_chunk_len: number;
    nitems: number;
    constructor({ dim_sel, dim_len, dim_chunk_len }: {
        dim_sel: number;
        dim_len: number;
        dim_chunk_len: number;
    });
    [Symbol.iterator](): IterableIterator<_ChunkDimProjection>;
}
interface _ChunkDimProjection {
    dim_chunk_ix: number;
    dim_chunk_sel: number | Slice;
    dim_out_sel: null | number | Slice;
}
declare class _SliceDimIndexer {
    start: number;
    stop: number;
    step: number;
    dim_len: number;
    dim_chunk_len: number;
    nitems: number;
    nchunks: number;
    constructor({ dim_sel, dim_len, dim_chunk_len }: {
        dim_sel: Slice;
        dim_len: number;
        dim_chunk_len: number;
    });
    [Symbol.iterator](): IterableIterator<_ChunkDimProjection>;
}
export declare class _BasicIndexer {
    dim_indexers: (_IntDimIndexer | _SliceDimIndexer)[];
    shape: number[];
    constructor({ selection, shape, chunk_shape, }: {
        selection: null | (null | number | Slice)[];
        shape: number[];
        chunk_shape: number[];
    });
    [Symbol.iterator](): IterableIterator<{
        chunk_coords: number[];
        chunk_selection: (number | Slice)[];
        out_selection: (null | number | Slice)[];
    }>;
}
export {};
