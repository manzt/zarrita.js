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

type DenoRuntime = {
	readFile(path: URL): Promise<Uint8Array>;
};

let decoderInitialization: Promise<void> | undefined;

async function initializeDecoder(): Promise<void> {
	const deno = (globalThis as typeof globalThis & { Deno?: DenoRuntime }).Deno;
	const isNode = typeof process !== "undefined" && !!process.versions?.node;
	if (!isNode && !deno) return;

	decoderInitialization ??= (async () => {
		let wasm: Uint8Array;
		if (isNode) {
			const [{ readFile }, { createRequire }] = await Promise.all([
				import("node:fs/promises"),
				import("node:module"),
			]);
			const decoderPath = createRequire(import.meta.url).resolve(
				"@jsquash/jpeg/codec/dec/mozjpeg_dec.js",
			);
			wasm = await readFile(decoderPath.replace(/\.js$/, ".wasm"));
		} else if (deno) {
			const wasmUrl = new URL(
				import.meta.resolve("@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm"),
			);
			wasm = await deno.readFile(wasmUrl);
		} else {
			return;
		}

		const wasmBytes = new Uint8Array(wasm.byteLength);
		wasmBytes.set(wasm);
		const { init } = await import("@jsquash/jpeg/decode.js");
		await init(await WebAssembly.compile(wasmBytes.buffer));
	})();
	await decoderInitialization;
}

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
		await initializeDecoder();
		const { decode } = await import("@jsquash/jpeg");
		const input = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(input).set(bytes);

		const image = await decode(input, { preserveOrientation: false });
		const { height, width } = this.#getDimensions();
		const pixels = width * height;

		if (image.width !== width || image.height !== height) {
			throw new InvalidMetadataError(
				`JPEG dimensions (${image.width}, ${image.height}) do not match chunk dimensions (${width}, ${height})`,
			);
		}

		if (this.#channels === 1) {
			const data = new Uint8Array(pixels);
			for (let pixel = 0; pixel < pixels; pixel++) {
				data[pixel] = image.data[pixel * 4];
			}
			return {
				data,
				shape: this.#shape,
				stride: getStrides(this.#shape, "C"),
			};
		}

		const data = new Uint8Array(pixels * 3);
		for (let pixel = 0; pixel < pixels; pixel++) {
			const inputOffset = pixel * 4;
			const outputOffset = pixel * 3;
			data[outputOffset] = image.data[inputOffset];
			data[outputOffset + 1] = image.data[inputOffset + 1];
			data[outputOffset + 2] = image.data[inputOffset + 2];
		}

		return {
			data,
			shape: this.#shape,
			stride: getStrides(this.#shape, [1, 2, 0]),
		};
	}
}
