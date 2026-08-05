import type {
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
} from "../typedarray.js";
import { assert, getStrides } from "../util.js";

type TypedArrayProxy<D extends DataType> = {
	[x: number]: Scalar<D>;
};

function proxy<D extends DataType>(arr: TypedArray<D>): TypedArrayProxy<D> {
	if (
		arr instanceof BoolArray ||
		arr instanceof ByteStringArray ||
		arr instanceof UnicodeStringArray
	) {
		// @ts-expect-error - TS cannot infer arr is a TypedArrayProxy<D>
		const arrp: TypedArrayProxy<D> = new Proxy(arr, {
			get(target, prop) {
				return target.get(Number(prop));
			},
			set(target, prop, value) {
				// @ts-expect-error - value is OK
				target.set(Number(prop), value);
				return true;
			},
		});
		return arrp;
	}
	// @ts-expect-error - TS cannot infer arr is a TypedArrayProxy<D>
	return arr;
}

function emptyLike<D extends DataType>(
	chunk: Chunk<D>,
	order: Order,
): Chunk<D> {
	let data: TypedArray<D>;
	if (
		chunk.data instanceof ByteStringArray ||
		chunk.data instanceof UnicodeStringArray
	) {
		// These constructors take the character width before the length.
		data = new (chunk.data.constructor as TypedArrayConstructor<D>)(
			// @ts-expect-error - the two argument form is not on the shared type
			chunk.data.chars,
			chunk.data.length,
		);
	} else {
		data = new (chunk.data.constructor as TypedArrayConstructor<D>)(
			chunk.data.length,
		);
	}
	return {
		data,
		shape: chunk.shape,
		stride: getStrides(chunk.shape, order),
	};
}

function convertArrayOrder<D extends DataType>(
	src: Chunk<D>,
	target: Order,
): Chunk<D> {
	let out = emptyLike(src, target);
	let nDims = src.shape.length;
	// Calculate the number of elements from the shape. The backing store can be
	// longer than the chunk when `src` is a view.
	let size = src.shape.reduce((a, b) => a * b, 1);
	let index = Array(nDims).fill(0);

	let srcData = proxy(src.data);
	let outData = proxy(out.data);

	for (let n = 0; n < size; n++) {
		let srcIdx = 0;
		let outIdx = 0;
		for (let dim = 0; dim < nDims; dim++) {
			srcIdx += index[dim] * src.stride[dim];
			outIdx += index[dim] * out.stride[dim];
		}
		outData[outIdx] = srcData[srcIdx];

		index[0] += 1;
		for (let dim = 0; dim < nDims; dim++) {
			if (index[dim] === src.shape[dim]) {
				if (dim + 1 === nDims) {
					break;
				}
				index[dim] = 0;
				index[dim + 1] += 1;
			}
		}
	}

	return out;
}

/** Determine the memory order (axis permutation) for a chunk */
function getOrder(chunk: Chunk<DataType>): number[] {
	let rank = chunk.shape.length;
	assert(
		rank === chunk.stride.length,
		"Shape and stride must have the same length.",
	);
	return chunk.stride
		.map((s, i) => ({ stride: s, index: i }))
		.sort((a, b) => b.stride - a.stride)
		.map((entry) => entry.index);
}

function matchesOrder(chunk: Chunk<DataType>, target: Order) {
	let source = getOrder(chunk);
	assert(source.length === target.length, "Orders must match");
	return source.every((dim, i) => dim === target[i]);
}

type Order = "C" | "F" | Array<number>;

export class TransposeCodec {
	kind = "array_to_array";
	#order: Array<number>;

	constructor(configuration: { order?: Order }, meta: { shape: number[] }) {
		let value = configuration.order ?? "C";
		let rank = meta.shape.length;
		let order = new Array<number>(rank);

		if (value === "C") {
			for (let i = 0; i < rank; ++i) {
				order[i] = i;
			}
		} else if (value === "F") {
			for (let i = 0; i < rank; ++i) {
				order[i] = rank - i - 1;
			}
		} else {
			order = value;
			// Each axis appears exactly once.
			let seen = new Array<boolean>(rank);
			order.forEach((x) => {
				assert(!seen[x], `Invalid permutation: ${JSON.stringify(value)}`);
				seen[x] = true;
			});
		}

		this.#order = order;
	}

	static fromConfig(
		configuration: { order: Order },
		meta: { shape: number[] },
	) {
		return new TransposeCodec(configuration, meta);
	}

	encode<D extends DataType>(arr: Chunk<D>): Chunk<D> {
		// `decode` returns a chunk in `#order`. The stored bytes must use the
		// same order.
		if (matchesOrder(arr, this.#order)) {
			return arr;
		}
		return convertArrayOrder(arr, this.#order);
	}

	decode<D extends DataType>(arr: Chunk<D>): Chunk<D> {
		return {
			data: arr.data,
			shape: arr.shape,
			stride: getStrides(arr.shape, this.#order),
		};
	}
}
