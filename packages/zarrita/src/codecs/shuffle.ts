import type { DataType } from "../metadata.js";
import { assert, getCtr } from "../util.js";

/**
 * Shuffle filter codec (numcodecs compat).
 *
 * Reorders bytes so that corresponding bytes of each element are grouped
 * together, improving compression of typed data.
 */
export class ShuffleCodec<D extends DataType> {
	kind = "bytes_to_bytes";
	#BYTES_PER_ELEMENT: number;

	constructor(configuration: { elementsize?: number }, meta?: { dataType: D }) {
		if (meta) {
			let sample = new (getCtr(meta.dataType))(0);
			assert(
				"BYTES_PER_ELEMENT" in sample,
				`Shuffle codec requires a fixed-size dtype, got "${meta.dataType}"`,
			);
			this.#BYTES_PER_ELEMENT = sample.BYTES_PER_ELEMENT as number;
		} else {
			this.#BYTES_PER_ELEMENT = configuration.elementsize ?? 4;
		}
	}

	static fromConfig<D extends DataType>(
		configuration: { elementsize?: number },
		meta?: { dataType: D },
	): ShuffleCodec<D> {
		return new ShuffleCodec(configuration, meta);
	}

	encode(data: Uint8Array): Uint8Array {
		return shuffle(data, this.#BYTES_PER_ELEMENT);
	}

	decode(data: Uint8Array): Uint8Array {
		return unshuffle(data, this.#BYTES_PER_ELEMENT);
	}
}

function shuffle(data: Uint8Array, elementSize: number): Uint8Array {
	let length = data.length;
	let nElements = Math.floor(length / elementSize);
	let result = new Uint8Array(length);
	for (let byte = 0; byte < elementSize; byte++) {
		for (let i = 0; i < nElements; i++) {
			result[byte * nElements + i] = data[i * elementSize + byte];
		}
	}
	return result;
}

function unshuffle(data: Uint8Array, elementSize: number): Uint8Array {
	let length = data.length;
	let nElements = Math.floor(length / elementSize);
	let result = new Uint8Array(length);
	for (let byte = 0; byte < elementSize; byte++) {
		for (let i = 0; i < nElements; i++) {
			result[i * elementSize + byte] = data[byte * nElements + i];
		}
	}
	return result;
}
