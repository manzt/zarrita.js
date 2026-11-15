import * as fs from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as url from "node:url";
import { init as initJPEGDecoder } from "@jsquash/jpeg/decode.js";
import { beforeAll, describe, expect, it } from "vitest";
import { createCodecPipeline } from "../src/codecs.js";
import type { ArrayMetadata } from "../src/metadata.js";

describe("JPEG codec interoperability fixture", () => {
	async function initializeDecoder() {
		const require = createRequire(import.meta.url);
		const decoderPath = require.resolve(
			"@jsquash/jpeg/codec/dec/mozjpeg_dec.js",
		);
		const wasm = await fs.readFile(decoderPath.replace(/\.js$/, ".wasm"));
		const wasmBytes = new Uint8Array(wasm.byteLength);
		wasmBytes.set(wasm);
		await initJPEGDecoder(await WebAssembly.compile(wasmBytes.buffer));
	}

	function createPipeline(metadata: ArrayMetadata<"uint8">) {
		return createCodecPipeline({
			dataType: metadata.data_type,
			shape: metadata.chunk_grid.configuration.chunk_shape,
			codecs: metadata.codecs,
			fillValue: metadata.fill_value,
		});
	}

	beforeAll(initializeDecoder);

	it("decodes a grayscale Zarr array written by zarr-ext-jpeg", async () => {
		const fixtureRoot = path.resolve(
			path.dirname(url.fileURLToPath(import.meta.url)),
			"../../../fixtures/codecs/jpeg",
		);
		const storePath = path.join(fixtureRoot, "grayscale.zarr");
		const metadata = JSON.parse(
			await fs.readFile(path.join(storePath, "zarr.json"), "utf8"),
		) as ArrayMetadata<"uint8">;
		const encoded = new Uint8Array(
			await fs.readFile(path.join(storePath, "c", "0", "0")),
		);
		const expected = JSON.parse(
			await fs.readFile(path.join(fixtureRoot, "grayscale.json"), "utf8"),
		) as { shape: number[]; dtype: string; data: number[][] };

		expect(metadata.shape).toEqual(expected.shape);
		expect(metadata.data_type).toBe(expected.dtype);
		expect(metadata.codecs).toEqual([
			{
				name: "jpeg",
				configuration: {
					quality: 95,
					encoded_color_space: "grayscale",
				},
			},
		]);

		const chunk = await createPipeline(metadata).decode(encoded);
		const source = expected.data.flat();
		const errors = source.map((value, i) => Math.abs(value - chunk.data[i]));

		expect(chunk.shape).toEqual(expected.shape);
		expect(chunk.stride).toEqual([expected.shape[1], 1]);
		expect(chunk.data).toHaveLength(source.length);
		expect(Math.max(...errors)).toBeLessThanOrEqual(5);
		expect(
			errors.reduce((sum, error) => sum + error, 0) / errors.length,
		).toBeLessThanOrEqual(1.5);
	});

	it("decodes a YCbCr Zarr array written by zarr-ext-jpeg", async () => {
		const fixtureRoot = path.resolve(
			path.dirname(url.fileURLToPath(import.meta.url)),
			"../../../fixtures/codecs/jpeg",
		);
		const storePath = path.join(fixtureRoot, "ycbcr.zarr");
		const metadata = JSON.parse(
			await fs.readFile(path.join(storePath, "zarr.json"), "utf8"),
		) as ArrayMetadata<"uint8">;
		const encoded = new Uint8Array(
			await fs.readFile(path.join(storePath, "c", "0", "0", "0")),
		);
		const expected = JSON.parse(
			await fs.readFile(path.join(fixtureRoot, "ycbcr.json"), "utf8"),
		) as { shape: number[]; dtype: string; data: number[][][] };

		expect(metadata.shape).toEqual(expected.shape);
		expect(metadata.data_type).toBe(expected.dtype);
		expect(metadata.codecs).toEqual([
			{ name: "transpose", configuration: { order: [1, 2, 0] } },
			{
				name: "jpeg",
				configuration: {
					quality: 95,
					encoded_color_space: "ycbcr",
					subsampling: [
						[2, 2],
						[1, 1],
						[1, 1],
					],
				},
			},
		]);

		const chunk = await createPipeline(metadata).decode(encoded);
		const [channels, height, width] = expected.shape;
		const errors: number[] = [];
		for (let channel = 0; channel < channels; channel++) {
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const source = expected.data[channel][y][x];
					const decoded =
						chunk.data[y * width * channels + x * channels + channel];
					errors.push(Math.abs(source - decoded));
				}
			}
		}

		expect(chunk.shape).toEqual(expected.shape);
		expect(chunk.stride).toEqual([1, width * channels, channels]);
		expect(errors).toHaveLength(channels * height * width);
		expect(Math.max(...errors)).toBeLessThanOrEqual(5);
		expect(
			errors.reduce((sum, error) => sum + error, 0) / errors.length,
		).toBeLessThanOrEqual(1.1);
	});

	it("decodes an RGB Zarr array written by zarr-ext-jpeg", async () => {
		const fixtureRoot = path.resolve(
			path.dirname(url.fileURLToPath(import.meta.url)),
			"../../../fixtures/codecs/jpeg",
		);
		const storePath = path.join(fixtureRoot, "rgb.zarr");
		const metadata = JSON.parse(
			await fs.readFile(path.join(storePath, "zarr.json"), "utf8"),
		) as ArrayMetadata<"uint8">;
		const encoded = new Uint8Array(
			await fs.readFile(path.join(storePath, "c", "0", "0", "0")),
		);
		const expected = JSON.parse(
			await fs.readFile(path.join(fixtureRoot, "rgb.json"), "utf8"),
		) as { shape: number[]; dtype: string; data: number[][][] };

		expect(metadata.shape).toEqual(expected.shape);
		expect(metadata.data_type).toBe(expected.dtype);
		expect(metadata.codecs).toEqual([
			{ name: "transpose", configuration: { order: [1, 2, 0] } },
			{
				name: "jpeg",
				configuration: {
					quality: 95,
					encoded_color_space: "rgb",
				},
			},
		]);

		const chunk = await createPipeline(metadata).decode(encoded);
		const [channels, height, width] = expected.shape;
		const errors: number[] = [];
		for (let channel = 0; channel < channels; channel++) {
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const source = expected.data[channel][y][x];
					const decoded =
						chunk.data[y * width * channels + x * channels + channel];
					errors.push(Math.abs(source - decoded));
				}
			}
		}

		expect(chunk.shape).toEqual(expected.shape);
		expect(chunk.stride).toEqual([1, width * channels, channels]);
		expect(errors).toHaveLength(channels * height * width);
		expect(Math.max(...errors)).toBeLessThanOrEqual(1);
		expect(
			errors.reduce((sum, error) => sum + error, 0) / errors.length,
		).toBeLessThanOrEqual(0.1);
	});
});
