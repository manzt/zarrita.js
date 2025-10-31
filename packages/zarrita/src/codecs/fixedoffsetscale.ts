import type { Chunk, NumberDataType, TypedArrayConstructor } from "../metadata.js"
import { coerce_dtype, get_ctr } from "../utils.js"

type FixedScaleOffsetConfig = {
    offset: number;
    scale: number;
    dtype: string;
    astype?: string;
}

export class FixedScaleOffsetCodec<D extends NumberDataType, A extends NumberDataType> {
    readonly kind = "array_to_array";

    #offset: number;
    #scale: number;
    #dtype: D;
    #TypedArray: TypedArrayConstructor<D>
    #astype: A;

    constructor(configuration: FixedScaleOffsetConfig) {
	this.#dtype = coerce_dtype(configuration.dtype);
	this.#TypedArray = get_ctr(this.#dtype);
	this.#astype = coerce_dtype(configuration.astype ?? configuration.dtype);
	this.#offset = configuration.offset;
	this.#scale = configuration.scale;
    }

    static fromConfig(configuration: FixedScaleOffsetConfig) {
	return new FixedScaleOffsetCodec(configuration);
    }

    encode(arr: Chunk<D>): Chunk<A> {
	throw new Error(
	    "`FixedScaleOffsetCodec.encode` is not implemented.  Please open an issue at https://github.com/manzt/zarrita.js/issues."
	);
    }

    decode(arr: Chunk<A>): Chunk<D> {
	const out_data = new this.#TypedArray(arr.data.length);
	arr.data.forEach((value, i) => {
	    out_data[i] = (value / this.#scale) + this.#offset;
	});
	return {
	    data: out_data,
	    shape: arr.shape,
	    stride: arr.stride,
	};
    }
}
