import { InvalidMetadataError } from "../errors.js";
import type { Chunk, DataType } from "../metadata.js";
import { getCtr, getStrides } from "../util.js";

/**
 * Data types pcodec can encode, with the code the WebAssembly module uses for each.
 */
const DTYPE_CODES = {
	uint8: 0,
	int8: 1,
	uint16: 2,
	int16: 3,
	uint32: 4,
	int32: 5,
	uint64: 6,
	int64: 7,
	float16: 8,
	float32: 9,
	float64: 10,
} as const;

type PcodecDataType = keyof typeof DTYPE_CODES;

const DELTA_CODES = {
	auto: 0,
	no_op: 1,
	none: 1, // deprecated alias of "no_op" in numcodecs
	try_consecutive: 2,
	try_lookback: 3,
} as const;

const MODE_CODES = { auto: 0, classic: 1 } as const;

/** The configuration numcodecs.PCodec writes (all optional; only `encode` reads them). */
export type PcodecConfig = {
	level?: number;
	mode_spec?: keyof typeof MODE_CODES;
	delta_spec?: keyof typeof DELTA_CODES;
	paging_spec?: "equal_pages_up_to";
	delta_encoding_order?: number | null;
	equal_pages_up_to?: number;
};

const DEFAULT_LEVEL = 8;
const DEFAULT_MAX_PAGE_N = 262144;

type PcodecExports = {
	memory: WebAssembly.Memory;
	alloc(len: number): number;
	dealloc(ptr: number, len: number): void;
	decompress(dtype: number, ptr: number, len: number): number;
	compress(
		dtype: number,
		level: number,
		delta: number,
		deltaOrder: number,
		mode: number,
		maxPageN: number,
		ptr: number,
		len: number,
	): number;
	result_ptr(): number;
	result_len(): number;
	free_result(): void;
};

let instance: Promise<PcodecExports> | undefined;

function decodeBase64(b64: string): Uint8Array {
	let binary = atob(b64);
	let bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/** Instantiates the embedded WebAssembly module once, on first use. */
function getInstance(): Promise<PcodecExports> {
	if (!instance) {
		instance = import("./pcodec-wasm.js").then(async ({ wasmBase64 }) => {
			let module = await WebAssembly.compile(
				decodeBase64(wasmBase64) as Uint8Array<ArrayBuffer>,
			);
			let instance = await WebAssembly.instantiate(module, {});
			return instance.exports as unknown as PcodecExports;
		});
	}
	return instance;
}

/**
 * Runs one call of the module: copies `input` in, calls `fn`, copies the result out.
 * Synchronous between the copy in and the copy out, so concurrent chunk decodes never interleave.
 */
function call(
	wasm: PcodecExports,
	input: Uint8Array,
	fn: (ptr: number, len: number) => number,
): Uint8Array {
	let ptr = wasm.alloc(input.byteLength);
	try {
		new Uint8Array(wasm.memory.buffer, ptr, input.byteLength).set(input);
		let status = fn(ptr, input.byteLength);
		// read only after the call: the module's memory may have grown
		let result = new Uint8Array(
			wasm.memory.buffer,
			wasm.result_ptr(),
			wasm.result_len(),
		).slice();
		if (status !== 0) {
			throw new Error(new TextDecoder().decode(result));
		}
		return result;
	} finally {
		wasm.dealloc(ptr, input.byteLength);
		wasm.free_result();
	}
}

/**
 * pcodec (pco): lossless compression of numerical sequences.
 *
 * Reads and writes chunks in pcodec's standalone format, as written by
 * `numcodecs.PCodec` (Zarr v3 codec name `numcodecs.pcodec`, Zarr v2 id `pcodec`). The
 * codec runs pcodec's Rust implementation (pco 1.1.0, the library behind Python's `pcodec`
 * 1.1.0), compiled to WebAssembly and loaded the first time a pcodec chunk is read.
 *
 * pcodec compresses each chunk as one flat sequence in C order. To make the sequence run
 * along time for (time, channel) data, writers put a `transpose` codec in front of it.
 *
 * @see {@link https://github.com/mwlon/pcodec}
 */
export class PcodecCodec<D extends DataType> {
	kind = "array_to_bytes";
	#dtypeCode: number;
	#TypedArray: ReturnType<typeof getCtr<D>>;
	#shape: number[];
	#stride: number[];
	#config: Required<Omit<PcodecConfig, "delta_encoding_order">> & {
		delta_encoding_order: number | null;
	};

	constructor(
		configuration: PcodecConfig | undefined,
		meta: { dataType: D; shape: number[] },
	) {
		if (!(meta.dataType in DTYPE_CODES)) {
			throw new InvalidMetadataError(
				`pcodec does not support data type "${meta.dataType}" (supported: ${Object.keys(DTYPE_CODES).join(", ")})`,
			);
		}
		this.#dtypeCode = DTYPE_CODES[meta.dataType as PcodecDataType];
		this.#TypedArray = getCtr(meta.dataType);
		this.#shape = meta.shape;
		this.#stride = getStrides(meta.shape, "C");
		this.#config = {
			level: configuration?.level ?? DEFAULT_LEVEL,
			mode_spec: configuration?.mode_spec ?? "auto",
			delta_spec: configuration?.delta_spec ?? "auto",
			paging_spec: configuration?.paging_spec ?? "equal_pages_up_to",
			delta_encoding_order: configuration?.delta_encoding_order ?? null,
			equal_pages_up_to: configuration?.equal_pages_up_to ?? DEFAULT_MAX_PAGE_N,
		};
	}

	static fromConfig<D extends DataType>(
		configuration: PcodecConfig | undefined,
		meta: { dataType: D; shape: number[] },
	): PcodecCodec<D> {
		return new PcodecCodec(configuration, meta);
	}

	async decode(bytes: Uint8Array): Promise<Chunk<D>> {
		let wasm = await getInstance();
		let out = call(wasm, bytes, (ptr, len) =>
			wasm.decompress(this.#dtypeCode, ptr, len),
		);
		let n = this.#shape.reduce((a, b) => a * b, 1);
		// @ts-expect-error - BYTES_PER_ELEMENT exists on every constructor pcodec supports
		let size: number = this.#TypedArray.BYTES_PER_ELEMENT;
		if (out.byteLength !== n * size) {
			throw new Error(
				`pcodec: decoded ${out.byteLength / size} values, the chunk holds ${n}`,
			);
		}
		return {
			data: new this.#TypedArray(out.buffer, out.byteOffset, n),
			shape: this.#shape,
			stride: this.#stride,
		};
	}

	async encode(chunk: Chunk<D>): Promise<Uint8Array> {
		let wasm = await getInstance();
		let { level, mode_spec, paging_spec, equal_pages_up_to } = this.#config;
		let { delta_spec, delta_encoding_order } = this.#config;
		if (paging_spec !== "equal_pages_up_to") {
			throw new InvalidMetadataError(
				`pcodec: unsupported paging_spec "${paging_spec}"`,
			);
		}
		// numcodecs: an explicit order with delta_spec "auto" means try_consecutive (backwards compatibility)
		if (delta_encoding_order !== null && delta_spec === "auto") {
			delta_spec = "try_consecutive";
		} else if (
			delta_encoding_order !== null &&
			delta_spec !== "try_consecutive"
		) {
			throw new InvalidMetadataError(
				"pcodec: delta_encoding_order can only be set for delta_spec 'try_consecutive'",
			);
		}
		let delta = DELTA_CODES[delta_spec];
		let mode = MODE_CODES[mode_spec];
		if (delta === undefined || mode === undefined) {
			throw new InvalidMetadataError(
				`pcodec: unsupported delta_spec "${delta_spec}" or mode_spec "${mode_spec}"`,
			);
		}
		let data = chunk.data as unknown as ArrayBufferView;
		let input = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
		return call(wasm, input, (ptr, len) =>
			wasm.compress(
				this.#dtypeCode,
				level,
				delta,
				delta_encoding_order ?? 0,
				mode,
				equal_pages_up_to,
				ptr,
				len,
			),
		);
	}
}
