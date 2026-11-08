import { InvalidMetadataError } from "../errors.js";
import type { Chunk, DataType } from "../metadata.js";
import { getStrides } from "../util.js";

type JPEGMetadata = {
	dataType: DataType;
	shape: number[];
};

type JPEGConfiguration = {
	encoded_color_space?: string;
};

export class JPEGCodec {
	kind = "array_to_bytes";
	#shape: number[];
	#channels: 1 | 3;

	constructor(configuration: JPEGConfiguration, meta: JPEGMetadata) {
		if (meta.dataType !== "uint8") {
			throw new InvalidMetadataError(
				`JPEG codec only supports uint8 data, got ${meta.dataType}`,
			);
		}

		this.#channels = configuration.encoded_color_space === "grayscale" ? 1 : 3;
		this.#shape = meta.shape.slice();
	}

	#getDimensions(): { height: number; width: number } {
		return this.#channels === 1
			? { height: this.#shape[0], width: this.#shape[1] }
			: { height: this.#shape[1], width: this.#shape[2] };
	}

	#removeAlphaChannel(image: ImageData, pixels: number): Uint8Array {
		const copy = new Uint8ClampedArray(image.data);
		for (let pixel = 0; pixel < pixels; pixel++) {
			const inputOffset = pixel * 4;
			const outputOffset = pixel * 3;
			copy[outputOffset] = copy[inputOffset];
			copy[outputOffset + 1] = copy[inputOffset + 1];
			copy[outputOffset + 2] = copy[inputOffset + 2];
		}
		return new Uint8Array(copy.buffer, copy.byteOffset, pixels * 3);
	}

	static fromConfig(
		configuration: JPEGConfiguration,
		meta: JPEGMetadata,
	): JPEGCodec {
		return new JPEGCodec(configuration, meta);
	}

	encode(_chunk: Chunk<"uint8">): Uint8Array {
		throw new Error("JPEG encoding is not implemented.");
	}

	async decode(bytes: Uint8Array): Promise<Chunk<"uint8">> {
		const { decode } = await import("@jsquash/jpeg");
		const input = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(input).set(bytes);

		const image = await decode(input, { preserveOrientation: false });
		const { height, width } = this.#getDimensions();
		const pixels = width * height;

		//Always for for @jsquash/jpeg decoder's RGBA return value.
		const values_per_pixel = image.data.length / pixels;

		if (image.width !== width || image.height !== height) {
			throw new InvalidMetadataError(
				`JPEG dimensions (${image.width}, ${image.height}) do not match chunk dimensions (${width}, ${height})`,
			);
		}

		//Decoder returns RGBA, so select arbitrary channel for grayscale
		if (this.#channels === 1) {
			const data = new Uint8Array(pixels);
			for (let pixel = 0; pixel < pixels; pixel++) {
				data[pixel] = image.data[pixel * values_per_pixel];
			}
			return {
				data,
				shape: this.#shape,
				stride: getStrides(this.#shape, "C"),
			};
		}

		const data = this.#removeAlphaChannel(image, pixels);

		return {
			data,
			shape: this.#shape,
			stride: getStrides(this.#shape, [1, 2, 0]),
		};
	}
}
