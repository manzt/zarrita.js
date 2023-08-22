import type {
	ArrayMetadata,
	Chunk,
	DataType,
	Scalar,
	TypedArray,
	TypedArrayConstructor,
} from "../metadata.js";
import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "@zarrita/typedarray";
import { get_strides } from "../util.js";

type TypedArrayProxy<D extends DataType> = {
	[x: number]: Scalar<D>;
};

function proxy<D extends DataType>(arr: TypedArray<D>): TypedArrayProxy<D> {
	if (
		arr instanceof BoolArray ||
		arr instanceof ByteStringArray ||
		arr instanceof UnicodeStringArray
	) {
		return new Proxy(arr as any, {
			get(target, prop) {
				return target.get(Number(prop));
			},
			set(target, prop, value) {
				target.set(Number(prop), value as any);
				return true;
			},
		});
	}
	return arr as any;
}

function empty_like<D extends DataType>(
	chunk: Chunk<D>,
	order: "C" | "F",
): Chunk<D> {
	let data: TypedArray<D>;
	if (
		chunk.data instanceof ByteStringArray ||
		chunk.data instanceof UnicodeStringArray
	) {
		data = new (chunk.constructor as TypedArrayConstructor<D>)(
			chunk.data.length,
			// @ts-expect-error
			chunk.data.chars,
		);
	} else {
		data = new (chunk.constructor as TypedArrayConstructor<D>)(
			chunk.data.length,
		);
	}
	return {
		data,
		shape: chunk.shape,
		stride: get_strides(chunk.shape, order),
	};
}

function convert_array_order<D extends DataType>(
	src: Chunk<D>,
	target: "C" | "F",
): Chunk<D> {
	let out = empty_like(src, target);
	let n_dims = src.shape.length;
	let size = src.data.length;
	let index = Array(n_dims).fill(0);

	let src_data = proxy(src.data);
	let out_data = proxy(out.data);

	for (let src_idx = 0; src_idx < size; src_idx++) {
		let out_idx = 0;
		for (let dim = 0; dim < n_dims; dim++) {
			out_idx += index[dim] * out.stride[dim];
		}
		out_data[out_idx] = src_data[src_idx];

		index[0] += 1;
		for (let dim = 0; dim < n_dims; dim++) {
			if (index[dim] === src.shape[dim]) {
				if (dim + 1 === n_dims) {
					break;
				}
				index[dim] = 0;
				index[dim + 1] += 1;
			}
		}
	}

	return out;
}

function get_order(arr: Chunk<DataType>): "C" | "F" {
	// Assume C order if no stride is given
	if (!arr.stride) return "C";
	let row_major_strides = get_strides(arr.shape, "C");
	return arr.stride.every((s, i) => s === row_major_strides[i]) ? "C" : "F";
}

export class TransposeCodec {
	kind = "array_to_array";

	constructor(
		public configuration: { order: "C" | "F" },
	) {}

	static fromConfig(
		configuration: { order: "C" | "F" },
	) {
		return new TransposeCodec(configuration);
	}

	encode<D extends DataType>(arr: Chunk<D>): Chunk<D> {
		if (get_order(arr) === this.configuration.order) {
			return arr;
		}
		return convert_array_order(arr, this.configuration.order);
	}

	decode<D extends DataType>(arr: Chunk<D>): Chunk<D> {
		return arr;
	}
}
