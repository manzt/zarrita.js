import * as zarr from "../src/index.js";

/** Read a chunk's values in logical (C) order, honoring its strides. */
export function toLogical<D extends zarr.DataType>(
	chunk: zarr.Chunk<D>,
): unknown[] {
	let { data, shape, stride } = chunk;
	let total = shape.reduce((a, b) => a * b, 1);
	let index = new globalThis.Array(shape.length).fill(0);
	let out: unknown[] = [];
	for (let n = 0; n < total; n++) {
		let offset = index.reduce((acc, v, d) => acc + v * stride[d], 0);
		out.push((data as ArrayLike<unknown>)[offset]);
		for (let d = shape.length - 1; d >= 0; d--) {
			if (++index[d] < shape[d]) break;
			index[d] = 0;
		}
	}
	return out;
}

export function cStride(shape: number[]) {
	return shape.map((_, i) => shape.slice(i + 1).reduce((a, b) => a * b, 1));
}

/** A C-ordered chunk holding `0..n`, offset by `base`. */
export function chunk(shape: number[], base = 0) {
	const size = shape.reduce((a, b) => a * b, 1);
	const data = new Int32Array(size);
	for (let i = 0; i < size; i++) {
		data[i] = base + i;
	}
	return { data, shape, stride: cStride(shape) };
}

/** An int32 array holding `0..n`, optionally stored with a transpose `order`. */
export async function filled(
	shape: number[],
	chunkShape: number[],
	order?: number[],
) {
	const codecs: zarr.CodecMetadata[] = [];
	if (order) {
		codecs.push({ name: "transpose", configuration: { order } });
	}
	codecs.push({ name: "bytes", configuration: { endian: "little" } });
	const arr = await zarr.create(zarr.root(new Map()).resolve("/a"), {
		shape,
		chunkShape,
		dtype: "int32",
		codecs,
	});
	await zarr.set(arr, null, chunk(shape));
	return arr;
}
