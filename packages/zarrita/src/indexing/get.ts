import type { Readable } from "@zarrita/storage";

import { type Array, getContext } from "../hierarchy.js";
import type { Chunk, DataType, Scalar, TypedArray } from "../metadata.js";
import {
	assertSharedArrayBufferAvailable,
	createBuffer,
	resolveSignal,
} from "../util.js";
import { BasicIndexer } from "./indexer.js";
import type {
	GetOptions,
	Prepare,
	Projection,
	SetFromChunk,
	SetScalar,
	Slice,
} from "./types.js";
import { createQueue } from "./util.js";

function unwrap<D extends DataType>(
	arr: TypedArray<D>,
	idx: number,
): Scalar<D> {
	return ("get" in arr ? arr.get(idx) : arr[idx]) as Scalar<D>;
}

export async function get<
	D extends DataType,
	Store extends Readable,
	Arr extends Chunk<D>,
	Sel extends (null | Slice | number)[],
>(
	arr: Array<D, Store>,
	selection: null | Sel,
	opts: GetOptions,
	setter: {
		prepare: Prepare<D, Arr>;
		setScalar: SetScalar<D, Arr>;
		setFromChunk: SetFromChunk<D, Arr>;
	},
): Promise<
	null extends Sel[number] ? Arr : Slice extends Sel[number] ? Arr : Scalar<D>
> {
	if (opts.useSharedArrayBuffer) {
		assertSharedArrayBufferAvailable();
	}

	let signal = resolveSignal(opts);
	let context = getContext(arr);
	let indexer = new BasicIndexer({
		selection,
		shape: arr.shape,
		chunkShape: arr.chunks,
	});

	// Handle scalar arrays (shape=[]) directly, since the indexer yields nothing
	// for zero-dimensional arrays.
	if (arr.shape.length === 0) {
		let { data } = await arr.getChunk(
			[],
			{ signal },
			{ useSharedArrayBuffer: opts.useSharedArrayBuffer },
		);
		// @ts-expect-error - TS can't narrow this conditional type
		return unwrap(data, 0);
	}

	let size = indexer.shape.reduce((a, b) => a * b, 1);
	let data: TypedArray<D>;
	if (opts.useSharedArrayBuffer) {
		let sample = new context.TypedArray(0);
		if (!("BYTES_PER_ELEMENT" in sample)) {
			console.warn(
				"zarrita: useSharedArrayBuffer is not supported for non-buffer-backed data types.",
			);
			data = new context.TypedArray(size);
		} else {
			let buffer = createBuffer(size * sample.BYTES_PER_ELEMENT, true);
			data = new context.TypedArray(buffer, 0, size);
		}
	} else {
		data = new context.TypedArray(size);
	}
	let out = setter.prepare(
		data,
		indexer.shape,
		context.getStrides(indexer.shape, indexer.outputAxes),
	);

	let queue = opts.createQueue?.() ?? createQueue();
	// Uncompressed chunks can be read in part: only the rows a selection touches.
	// An array extension that overrides `getChunk` must see every chunk read,
	// so those arrays read whole chunks through it.
	let getChunkRows =
		opts.useSharedArrayBuffer || overridesGetChunk(arr)
			? undefined
			: context.getChunkRows;
	for (const { chunkCoords, mapping } of indexer) {
		queue.add(async () => {
			signal?.throwIfAborted();
			let rows =
				getChunkRows && selectedRows(mapping[0], context.chunkShape[0]);
			if (getChunkRows && rows) {
				let [first, stop] = rows;
				let shape = [stop - first, ...context.chunkShape.slice(1)];
				let part = await getChunkRows(chunkCoords, first, stop, { signal });
				if (!part) {
					let data = new context.TypedArray(shape.reduce((a, b) => a * b, 1));
					// @ts-expect-error: TS can't infer that `fillValue` is union (assumes never) but this is ok
					data.fill(context.fillValue);
					part = { data, shape, stride: context.getStrides(shape) };
				}
				let chunk = setter.prepare(part.data, part.shape, part.stride);
				setter.setFromChunk(out, chunk, shiftRows(mapping, first));
				return;
			}
			let { data, shape, stride } = await arr.getChunk(
				chunkCoords,
				{ signal },
				{ useSharedArrayBuffer: opts.useSharedArrayBuffer },
			);
			let chunk = setter.prepare(data, shape, stride);
			setter.setFromChunk(out, chunk, mapping);
		});
	}

	await queue.onIdle();

	// If the final out shape is empty (point selection), return a scalar.
	// @ts-expect-error - TS can't narrow this conditional type
	return indexer.shape.length === 0 ? unwrap(out.data, 0) : out;
}

/**
 * Whether `getChunk` was replaced on this array, as an array extension does.
 * `Array` defines `getChunk` on its prototype, so an own property is an override.
 */
function overridesGetChunk(arr: object): boolean {
	return Object.getOwnPropertyDescriptor(arr, "getChunk") !== undefined;
}

/**
 * The first row along axis 0 that a chunk projection reads and one past the
 * last, or undefined when it reads every row or the rows are unknown.
 */
function selectedRows(
	projection: Projection,
	chunkRows: number,
): [number, number] | undefined {
	let first: number;
	let stop: number;
	if (typeof projection.from === "number") {
		first = projection.from;
		stop = first + 1;
	} else if (globalThis.Array.isArray(projection.from)) {
		let [start, end, step] = projection.from;
		if (step <= 0 || end <= start) return undefined;
		first = start;
		stop = start + (Math.ceil((end - start) / step) - 1) * step + 1;
	} else {
		return undefined;
	}
	return first === 0 && stop === chunkRows ? undefined : [first, stop];
}

/** The projections relative to the rows read, which start at row `first`. */
function shiftRows(mapping: Projection[], first: number): Projection[] {
	let [head, ...rest] = mapping;
	if (typeof head.from === "number") {
		return [{ from: head.from - first, to: null }, ...rest];
	}
	if (
		globalThis.Array.isArray(head.from) &&
		globalThis.Array.isArray(head.to)
	) {
		let [start, stop, step] = head.from;
		return [
			{ from: [start - first, stop - first, step], to: head.to },
			...rest,
		];
	}
	return mapping;
}
