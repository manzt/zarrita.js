import type { Chunk, NumberDataType, TypedArrayConstructor } from "../metadata.js"
import { coerce_dtype, get_ctr } from "../util.js"

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
    #TypedArrayIn: TypedArrayConstructor<D>
    #TypedArrayOut: TypedArrayConstructor<A>

    constructor(configuration: FixedScaleOffsetConfig) {
        const { data_type } = coerce_dtype(configuration.dtype);
	this.#TypedArrayIn = get_ctr(data_type as NumberDataType);
        const { data_type: as_data_type } = coerce_dtype(configuration.astype ?? configuration.dtype);
	this.#TypedArrayOut = get_ctr(as_data_type as NumberDataType);

	this.#offset = configuration.offset;
	this.#scale = configuration.scale;
    }

    static fromConfig(configuration: FixedScaleOffsetConfig) {
	return new FixedScaleOffsetCodec(configuration);
    }

    encode(arr: Chunk<D>): Chunk<A> {
        const data = new this.#TypedArrayOut(arr.data.length);
	arr.data.forEach((value: number, i: number) => {
	    data[i] = (value - this.#offset) * this.#scale;
	});
        return {
            data,
            shape: arr.shape,
            stride: arr.stride
        }
    }

    decode(arr: Chunk<A>): Chunk<D> {
	const out_data = new this.#TypedArrayIn(arr.data.length);
	arr.data.forEach((value: number, i: number) => {
	    out_data[i] = (value / this.#scale) + this.#offset;
	});
	return {
	    data: out_data,
	    shape: arr.shape,
	    stride: arr.stride,
	};
    }
}
