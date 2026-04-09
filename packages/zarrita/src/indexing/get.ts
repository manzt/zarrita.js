import type { Readable } from "@zarrita/storage";

import { type Array, getContext } from "../hierarchy.js";
import type { Chunk, DataType, Scalar, TypedArray } from "../metadata.js";
import {
	assertSharedArrayBufferAvailable,
	createBuffer,
	isAbortable,
} from "../util.js";
import { BasicIndexer } from "./indexer.js";
import type {
	GetOptions,
	Prepare,
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
	opts: GetOptions<Parameters<Store["get"]>[1]>,
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

	let context = getContext(arr);
	let indexer = new BasicIndexer({
		selection,
		shape: arr.shape,
		chunkShape: arr.chunks,
	});

	// Handle scalar arrays (shape=[]) directly, since the indexer yields nothing
	// for zero-dimensional arrays.
	if (arr.shape.length === 0) {
		let { data } = await arr.getChunk([], opts.opts, {
			useSharedArrayBuffer: opts.useSharedArrayBuffer,
		});
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
		context.getStrides(indexer.shape),
	);

	let queue = opts.createQueue?.() ?? createQueue();
	for (const { chunkCoords, mapping } of indexer) {
		queue.add(async () => {
			if (isAbortable(opts.opts)) {
				opts.opts.signal.throwIfAborted();
			}
			let { data, shape, stride } = await arr.getChunk(chunkCoords, opts.opts, {
				useSharedArrayBuffer: opts.useSharedArrayBuffer,
			});
			let chunk = setter.prepare(data, shape, stride);
			setter.setFromChunk(out, chunk, mapping);
		});
	}

	await queue.onIdle();

	// If the final out shape is empty (point selection), return a scalar.
	// @ts-expect-error - TS can't narrow this conditional type
	return indexer.shape.length === 0 ? unwrap(out.data, 0) : out;
}
