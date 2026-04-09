import type {
	Chunk,
	CodecMetadata,
	DataType,
	TypedArrayConstructor,
} from "../metadata.js";
import { byteswapInplace, getCtr, getStrides } from "../util.js";

const LITTLE_ENDIAN_OS = systemIsLittleEndian();

function systemIsLittleEndian(): boolean {
	const a = new Uint32Array([0x12345678]);
	const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
	return !(b[0] === 0x12);
}

function bytesPerElement<D extends DataType>(
	TypedArray: TypedArrayConstructor<D>,
): number {
	if ("BYTES_PER_ELEMENT" in TypedArray) {
		return TypedArray.BYTES_PER_ELEMENT as number;
	}
	// Unicode string array is backed by a Int32Array.
	return 4;
}

export class BytesCodec<D extends Exclude<DataType, "v2:object" | "string">> {
	kind = "array_to_bytes";
	#stride: Array<number>;
	#TypedArray: TypedArrayConstructor<D>;
	#BYTES_PER_ELEMENT: number;
	#shape: Array<number>;
	#endian?: "little" | "big";

	constructor(
		configuration: { endian?: "little" | "big" } | undefined,
		meta: { dataType: D; shape: number[]; codecs: CodecMetadata[] },
	) {
		this.#endian = configuration?.endian;
		this.#TypedArray = getCtr(meta.dataType);
		this.#shape = meta.shape;
		this.#stride = getStrides(meta.shape, "C");
		// TODO: fix me.
		// hack to get bytes per element since it's dynamic for string types.
		const sample = new this.#TypedArray(0);
		this.#BYTES_PER_ELEMENT = sample.BYTES_PER_ELEMENT;
	}

	static fromConfig<D extends Exclude<DataType, "v2:object" | "string">>(
		configuration: { endian: "little" | "big" },
		meta: { dataType: D; shape: number[]; codecs: CodecMetadata[] },
	): BytesCodec<D> {
		return new BytesCodec(configuration, meta);
	}

	encode(arr: Chunk<D>): Uint8Array {
		let bytes = new Uint8Array(arr.data.buffer);
		if (LITTLE_ENDIAN_OS && this.#endian === "big") {
			byteswapInplace(bytes, bytesPerElement(this.#TypedArray));
		}
		return bytes;
	}

	decode(bytes: Uint8Array): Chunk<D> {
		if (LITTLE_ENDIAN_OS && this.#endian === "big") {
			byteswapInplace(bytes, bytesPerElement(this.#TypedArray));
		}
		return {
			data: new this.#TypedArray(
				bytes.buffer,
				bytes.byteOffset,
				bytes.byteLength / this.#BYTES_PER_ELEMENT,
			),
			shape: this.#shape,
			stride: this.#stride,
		};
	}
}
