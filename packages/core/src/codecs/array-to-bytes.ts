// @ts-nocheck
import type {
	ArrayMetadata,
	Chunk,
	DataType,
	TypedArrayConstructor,
} from "../metadata.js";
import { get_ctr, get_strides, v2_marker } from "../util.js";

export class ArrayToBytes<D extends DataType> {
	kind = "array_to_bytes";
	#chunk_stride: number[];
	#TypedArray: TypedArrayConstructor<D>;

	constructor(
		public configuration: { [v2_marker]?: string },
		public array_metadata: ArrayMetadata<D>,
	) {
		let maybe_transpose_codec = this.array_metadata.codecs.find((c) =>
			c.name === "transpose"
		);
		this.#chunk_stride = get_strides(
			array_metadata.chunk_grid.configuration.chunk_shape,
			maybe_transpose_codec?.configuration.order === "F" ? "F" : "C",
		);
		this.#TypedArray = get_ctr(
			this.array_metadata.data_type,
			configuration[v2_marker],
		);
	}

	static fromConfig<D extends DataType>(
		configuration: { [v2_marker]?: string },
		array_metadata: ArrayMetadata<D>,
	) {
		return new ArrayToBytes(configuration, array_metadata);
	}

	encode(chunk: Chunk<D>): Uint8Array {
		return new Uint8Array(chunk.data.buffer);
	}

	decode(bytes: Uint8Array): Chunk<D> {
		return {
			data: new this.#TypedArray(bytes.buffer),
			shape: this.array_metadata.chunk_grid.configuration.chunk_shape,
			stride: this.#chunk_stride,
		};
	}
}
