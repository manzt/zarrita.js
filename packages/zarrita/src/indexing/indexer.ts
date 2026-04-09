import type { Indices, Slice } from "./types.js";
import { product, range, slice, sliceIndices } from "./util.js";

export class IndexError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = "IndexError";
	}
}

function errTooManyIndices(
	selection: (number | Slice)[],
	shape: readonly number[],
) {
	throw new IndexError(
		`too many indicies for array; expected ${shape.length}, got ${selection.length}`,
	);
}

function errBoundscheck(dimLen: number) {
	throw new IndexError(
		`index out of bounds for dimension with length ${dimLen}`,
	);
}

function errNegativeStep() {
	throw new IndexError("only slices with step >= 1 are supported");
}

function checkSelectionLength(
	selection: (number | Slice)[],
	shape: readonly number[],
) {
	if (selection.length > shape.length) {
		errTooManyIndices(selection, shape);
	}
}

export function normalizeIntegerSelection(dimSel: number, dimLen: number) {
	// normalize type to int
	dimSel = Math.trunc(dimSel);
	// handle wraparound
	if (dimSel < 0) {
		dimSel = dimLen + dimSel;
	}
	// handle out of bounds
	if (dimSel >= dimLen || dimSel < 0) {
		errBoundscheck(dimLen);
	}
	return dimSel;
}

interface IntChunkDimProjection {
	dimChunkIx: number;
	dimChunkSel: number;
}

interface IntDimIndexerProps {
	dimSel: number;
	dimLen: number;
	dimChunkLen: number;
}

class IntDimIndexer {
	dimSel: number;
	dimLen: number;
	dimChunkLen: number;
	nitems: 1;

	constructor({ dimSel, dimLen, dimChunkLen }: IntDimIndexerProps) {
		// normalize
		dimSel = normalizeIntegerSelection(dimSel, dimLen);
		// store properties
		this.dimSel = dimSel;
		this.dimLen = dimLen;
		this.dimChunkLen = dimChunkLen;
		this.nitems = 1;
	}

	*[Symbol.iterator](): IterableIterator<IntChunkDimProjection> {
		const dimChunkIx = Math.floor(this.dimSel / this.dimChunkLen);
		const dimOffset = dimChunkIx * this.dimChunkLen;
		const dimChunkSel = this.dimSel - dimOffset;
		yield { dimChunkIx, dimChunkSel };
	}
}

interface SliceChunkDimProjection {
	dimChunkIx: number;
	dimChunkSel: Indices;
	dimOutSel: Indices;
}

interface SliceDimIndexerProps {
	dimSel: Slice;
	dimLen: number;
	dimChunkLen: number;
}

class SliceDimIndexer {
	start: number;
	stop: number;
	step: number;

	dimLen: number;
	dimChunkLen: number;
	nitems: number;
	nchunks: number;

	constructor({ dimSel, dimLen, dimChunkLen }: SliceDimIndexerProps) {
		// normalize
		const [start, stop, step] = sliceIndices(dimSel, dimLen);
		this.start = start;
		this.stop = stop;
		this.step = step;
		if (this.step < 1) errNegativeStep();
		// store properties
		this.dimLen = dimLen;
		this.dimChunkLen = dimChunkLen;
		this.nitems = Math.max(0, Math.ceil((this.stop - this.start) / this.step));
		this.nchunks = Math.ceil(this.dimLen / this.dimChunkLen);
	}

	*[Symbol.iterator](): IterableIterator<SliceChunkDimProjection> {
		// figure out the range of chunks we need to visit
		const dimChunkIx_from = Math.floor(this.start / this.dimChunkLen);
		const dimChunkIx_to = Math.ceil(this.stop / this.dimChunkLen);
		for (const dimChunkIx of range(dimChunkIx_from, dimChunkIx_to)) {
			// compute offsets for chunk within overall array
			const dimOffset = dimChunkIx * this.dimChunkLen;
			const dimLimit = Math.min(
				this.dimLen,
				(dimChunkIx + 1) * this.dimChunkLen,
			);
			// determine chunk length, accounting for trailing chunk
			const dimChunkLen = dimLimit - dimOffset;

			let dimOutOffset = 0;
			let dimChunkSelStart = 0;
			if (this.start < dimOffset) {
				// selection start before current chunk
				const remainder = (dimOffset - this.start) % this.step;
				if (remainder) dimChunkSelStart += this.step - remainder;
				// compute number of previous items, provides offset into output array
				dimOutOffset = Math.ceil((dimOffset - this.start) / this.step);
			} else {
				// selection starts within current chunk
				dimChunkSelStart = this.start - dimOffset;
			}
			// selection starts within current chunk if true,
			// otherwise selection ends after current chunk.
			const dimChunkSelStop =
				this.stop > dimLimit ? dimChunkLen : this.stop - dimOffset;

			const dimChunkSel: Indices = [
				dimChunkSelStart,
				dimChunkSelStop,
				this.step,
			];
			const dimChunkNitems = Math.ceil(
				(dimChunkSelStop - dimChunkSelStart) / this.step,
			);

			const dimOutSel: Indices = [
				dimOutOffset,
				dimOutOffset + dimChunkNitems,
				1,
			];
			yield { dimChunkIx, dimChunkSel, dimOutSel };
		}
	}
}

export function normalizeSelection(
	selection: null | (Slice | null | number)[],
	shape: readonly number[],
): (number | Slice)[] {
	let normalized: (number | Slice)[] = [];
	if (selection === null) {
		normalized = shape.map((_) => slice(null));
	} else if (Array.isArray(selection)) {
		normalized = selection.map((s) => s ?? slice(null));
	}
	checkSelectionLength(normalized, shape);
	return normalized;
}

interface BasicIndexerProps {
	selection: null | (null | number | Slice)[];
	shape: readonly number[];
	chunkShape: readonly number[];
}

export type IndexerProjection =
	| { from: number; to: null }
	| {
			from: Indices;
			to: Indices;
	  };

interface ChunkProjection {
	chunkCoords: number[];
	mapping: IndexerProjection[];
}

export class BasicIndexer {
	dimIndexers: (SliceDimIndexer | IntDimIndexer)[];
	shape: number[];

	constructor({ selection, shape, chunkShape }: BasicIndexerProps) {
		// setup per-dimension indexers
		this.dimIndexers = normalizeSelection(selection, shape).map((dimSel, i) => {
			return new (typeof dimSel === "number" ? IntDimIndexer : SliceDimIndexer)(
				{
					// @ts-expect-error ts inference not strong enough to know correct chunk
					dimSel: dimSel,
					dimLen: shape[i],
					dimChunkLen: chunkShape[i],
				},
			);
		});
		this.shape = this.dimIndexers
			.filter((ixr) => ixr instanceof SliceDimIndexer)
			.map((sixr) => sixr.nitems);
	}

	*[Symbol.iterator](): IterableIterator<ChunkProjection> {
		for (const dimProjections of product(...this.dimIndexers)) {
			const chunkCoords = dimProjections.map((p) => p.dimChunkIx);
			const mapping: IndexerProjection[] = dimProjections.map((p) => {
				if ("dimOutSel" in p) {
					return { from: p.dimChunkSel, to: p.dimOutSel };
				}
				return { from: p.dimChunkSel, to: null };
			});
			yield { chunkCoords, mapping };
		}
	}
}
