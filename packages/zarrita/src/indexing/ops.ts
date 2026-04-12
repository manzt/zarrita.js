import type { Mutable, Readable } from "@zarrita/storage";

import type { Array } from "../hierarchy.js";
import type {
	Chunk,
	DataType,
	Scalar,
	TypedArray,
	TypedArrayConstructor,
} from "../metadata.js";
import { get as get_with_setter } from "./get.js";
import { set as set_with_setter } from "./set.js";
import type {
	GetOptions,
	Indices,
	Projection,
	SetOptions,
	Slice,
} from "./types.js";

/** A 1D "view" of an array that can be used to set values in the array. */
function objectArrayView<T>(arr: T[], offset = 0, size?: number) {
	let length = size ?? arr.length - offset;
	return {
		length,
		subarray(from: number, to: number = length) {
			return objectArrayView(arr, offset + from, to - from);
		},
		set(data: { get(idx: number): T; length: number }, start = 0) {
			for (let i = 0; i < data.length; i++) {
				arr[offset + start + i] = data.get(i);
			}
		},
		get(index: number) {
			return arr[offset + index];
		},
	};
}

/**
 * Convert a chunk to a Uint8Array that can be used with the binary
 * set functions. This is necessary because the binary set functions
 * require a contiguous block of memory, and allows us to support more than
 * just the browser's TypedArray objects.
 *
 * WARNING: This function is not meant to be used directly and is NOT type-safe.
 * In the case of `Array` instances, it will return a `objectArrayView` of
 * the underlying, which is supported by our binary set functions.
 */
function compatChunk<D extends DataType>(
	arr: Chunk<D>,
): {
	data: Uint8Array;
	stride: number[];
	bytesPerElement: number;
} {
	if (globalThis.Array.isArray(arr.data)) {
		return {
			// @ts-expect-error
			data: objectArrayView(arr.data),
			stride: arr.stride,
			bytesPerElement: 1,
		};
	}
	return {
		data: new Uint8Array(
			arr.data.buffer,
			arr.data.byteOffset,
			arr.data.byteLength,
		),
		stride: arr.stride,
		bytesPerElement: arr.data.BYTES_PER_ELEMENT,
	};
}

/** Hack to get the constructor of a typed array constructor from an existing TypedArray. */
function getTypedArrayConstructor<
	D extends Exclude<DataType, "v2:object" | "string">,
>(arr: TypedArray<D>): TypedArrayConstructor<D> {
	if ("chars" in arr) {
		// our custom TypedArray needs to bind the number of characters per
		// element to the constructor.
		return arr.constructor.bind(null, arr.chars);
	}
	return arr.constructor as TypedArrayConstructor<D>;
}

/**
 * Convert a scalar to a Uint8Array that can be used with the binary
 * set functions. This is necessary because the binary set functions
 * require a contiguous block of memory, and allows us to support more
 * than just the browser's TypedArray objects.
 *
 * WARNING: This function is not meant to be used directly and is NOT type-safe.
 * In the case of `Array` instances, it will return a `objectArrayView` of
 * the scalar, which is supported by our binary set functions.
 */
function compatScalar<D extends DataType>(
	arr: Chunk<D>,
	value: Scalar<D>,
): Uint8Array {
	if (globalThis.Array.isArray(arr.data)) {
		// @ts-expect-error
		return objectArrayView([value]);
	}
	let TypedArray = getTypedArrayConstructor(arr.data);
	// @ts-expect-error - value is a scalar and matches
	let data = new TypedArray([value]);
	return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

export const setter = {
	prepare<D extends DataType>(
		data: TypedArray<D>,
		shape: number[],
		stride: number[],
	) {
		return { data, shape, stride };
	},
	setScalar<D extends DataType>(
		dest: Chunk<D>,
		sel: (number | Indices)[],
		value: Scalar<D>,
	) {
		let view = compatChunk(dest);
		setScalarBinary(view, sel, compatScalar(dest, value), view.bytesPerElement);
	},
	setFromChunk<D extends DataType>(
		dest: Chunk<D>,
		src: Chunk<D>,
		projections: Projection[],
	) {
		let view = compatChunk(dest);
		setFromChunkBinary(
			view,
			compatChunk(src),
			view.bytesPerElement,
			projections,
		);
	},
};

/** @category Utility */
export async function get<
	D extends DataType,
	Store extends Readable,
	Sel extends (null | Slice | number)[],
>(
	arr: Array<D, Store>,
	selection: Sel | null = null,
	opts: GetOptions = {},
): Promise<
	null extends Sel[number]
		? Chunk<D>
		: Slice extends Sel[number]
			? Chunk<D>
			: Scalar<D>
> {
	return get_with_setter<D, Store, Chunk<D>, Sel>(arr, selection, opts, setter);
}

/** @category Utility */
export async function set<D extends DataType>(
	arr: Array<D, Mutable>,
	selection: (null | Slice | number)[] | null,
	value: Scalar<D> | Chunk<D>,
	opts: SetOptions = {},
): Promise<void> {
	return set_with_setter<D, Chunk<D>>(arr, selection, value, opts, setter);
}

function indicesLen(start: number, stop: number, step: number) {
	if (step < 0 && stop < start) {
		return Math.floor((start - stop - 1) / -step) + 1;
	}
	if (start < stop) return Math.floor((stop - start - 1) / step) + 1;
	return 0;
}

function setScalarBinary(
	out: { data: Uint8Array; stride: number[] },
	outSelection: (Indices | number)[],
	value: Uint8Array,
	bytesPerElement: number,
) {
	if (outSelection.length === 0) {
		out.data.set(value, 0);
		return;
	}
	const [slice, ...slices] = outSelection;
	const [currStride, ...stride] = out.stride;
	if (typeof slice === "number") {
		const data = out.data.subarray(currStride * slice * bytesPerElement);
		setScalarBinary({ data, stride }, slices, value, bytesPerElement);
		return;
	}
	const [from, to, step] = slice;
	const len = indicesLen(from, to, step);
	if (slices.length === 0) {
		for (let i = 0; i < len; i++) {
			out.data.set(value, currStride * (from + step * i) * bytesPerElement);
		}
		return;
	}
	for (let i = 0; i < len; i++) {
		const data = out.data.subarray(
			currStride * (from + step * i) * bytesPerElement,
		);
		setScalarBinary({ data, stride }, slices, value, bytesPerElement);
	}
}

function setFromChunkBinary(
	dest: { data: Uint8Array; stride: number[] },
	src: { data: Uint8Array; stride: number[] },
	bytesPerElement: number,
	projections: Projection[],
) {
	const [proj, ...projs] = projections;
	const [dstride, ...dstrides] = dest.stride;
	const [sstride, ...sstrides] = src.stride;
	if (proj.from === null) {
		if (projs.length === 0) {
			dest.data.set(
				src.data.subarray(0, bytesPerElement),
				proj.to * bytesPerElement,
			);
			return;
		}
		setFromChunkBinary(
			{
				data: dest.data.subarray(dstride * proj.to * bytesPerElement),
				stride: dstrides,
			},
			src,
			bytesPerElement,
			projs,
		);
		return;
	}
	if (proj.to === null) {
		if (projs.length === 0) {
			let offset = proj.from * bytesPerElement;
			dest.data.set(src.data.subarray(offset, offset + bytesPerElement), 0);
			return;
		}
		setFromChunkBinary(
			dest,
			{
				data: src.data.subarray(sstride * proj.from * bytesPerElement),
				stride: sstrides,
			},
			bytesPerElement,
			projs,
		);
		return;
	}
	const [from, to, step] = proj.to;
	const [sfrom, _, sstep] = proj.from;
	const len = indicesLen(from, to, step);
	if (projs.length === 0) {
		// NB: we have a contiguous block of memory
		// so we can just copy over all the data at once.
		if (step === 1 && sstep === 1 && dstride === 1 && sstride === 1) {
			let offset = sfrom * bytesPerElement;
			let size = len * bytesPerElement;
			dest.data.set(
				src.data.subarray(offset, offset + size),
				from * bytesPerElement,
			);
			return;
		}
		// Otherwise, we have to copy over each element individually.
		for (let i = 0; i < len; i++) {
			let offset = sstride * (sfrom + sstep * i) * bytesPerElement;
			dest.data.set(
				src.data.subarray(offset, offset + bytesPerElement),
				dstride * (from + step * i) * bytesPerElement,
			);
		}
		return;
	}
	for (let i = 0; i < len; i++) {
		setFromChunkBinary(
			{
				data: dest.data.subarray(dstride * (from + i * step) * bytesPerElement),
				stride: dstrides,
			},
			{
				data: src.data.subarray(
					sstride * (sfrom + i * sstep) * bytesPerElement,
				),
				stride: sstrides,
			},
			bytesPerElement,
			projs,
		);
	}
}
