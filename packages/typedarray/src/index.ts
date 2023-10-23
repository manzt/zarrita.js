export class BoolArray {
	#bytes: Uint8Array;

	constructor(size: number);
	constructor(arr: Iterable<boolean>);
	constructor(buffer: ArrayBuffer, byteOffset?: number, length?: number);
	constructor(
		x: number | Iterable<boolean> | ArrayBuffer,
		byteOffset?: number,
		length?: number,
	) {
		if (typeof x === "number") {
			this.#bytes = new Uint8Array(x);
		} else if (x instanceof ArrayBuffer) {
			this.#bytes = new Uint8Array(x, byteOffset, length);
		} else {
			this.#bytes = new Uint8Array(Array.from(x, (v) => (v ? 1 : 0)));
		}
	}

	get BYTES_PER_ELEMENT() {
		return 1;
	}

	get byteOffset() {
		return this.#bytes.byteOffset;
	}

	get byteLength() {
		return this.#bytes.byteLength;
	}

	/** @type {ArrayBuffer} */
	get buffer() {
		return this.#bytes.buffer;
	}

	/** @type {number} */
	get length() {
		return this.#bytes.length;
	}

	get(idx: number): boolean {
		let value = this.#bytes[idx];
		return typeof value === "number" ? value !== 0 : value;
	}

	set(idx: number, value: boolean): void {
		this.#bytes[idx] = value ? 1 : 0;
	}

	fill(value: boolean) {
		this.#bytes.fill(value ? 1 : 0);
	}

	*[Symbol.iterator](): IterableIterator<boolean> {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

export class ByteStringArray {
	_data: Uint8Array;
	chars: number;
	#encoder: TextEncoder;

	constructor(chars: number, size: number);
	constructor(
		chars: number,
		buffer: ArrayBuffer,
		byteOffset?: number,
		length?: number,
	);
	constructor(chars: number, arr: Iterable<string>);
	constructor(
		chars: number,
		x: number | ArrayBuffer | Iterable<string>,
		byteOffset?: number,
		length?: number,
	) {
		this.chars = chars;
		this.#encoder = new TextEncoder();
		if (typeof x === "number") {
			this._data = new Uint8Array(x * chars);
		} else if (x instanceof ArrayBuffer) {
			if (length) length = length * chars;
			this._data = new Uint8Array(x, byteOffset, length);
		} else {
			let values = Array.from(x);
			this._data = new Uint8Array(values.length * chars);
			for (let i = 0; i < values.length; i++) {
				this.set(i, values[i]);
			}
		}
	}

	get BYTES_PER_ELEMENT() {
		return this.chars;
	}

	get byteOffset() {
		return this._data.byteOffset;
	}

	get byteLength() {
		return this._data.byteLength;
	}

	/** @type {ArrayBuffer} */
	get buffer() {
		return this._data.buffer;
	}

	/** @type {number} */
	get length() {
		return this.byteLength / this.BYTES_PER_ELEMENT;
	}

	get(idx: number) {
		const view = new Uint8Array(
			this.buffer,
			this.byteOffset + this.chars * idx,
			this.chars,
		);
		return new TextDecoder().decode(view).replace(/\x00/g, "");
	}

	set(idx: number, value: string) {
		const view = new Uint8Array(
			this.buffer,
			this.byteOffset + this.chars * idx,
			this.chars,
		);
		view.fill(0); // clear current
		view.set(this.#encoder.encode(value));
	}

	fill(value: string) {
		const encoded = this.#encoder.encode(value);
		for (let i = 0; i < this.length; i++) {
			this._data.set(encoded, i * this.chars);
		}
	}

	*[Symbol.iterator](): IterableIterator<string> {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

export class UnicodeStringArray {
	#data: Int32Array;
	chars: number;
	#encode_buffer: Int32Array;

	constructor(chars: number, size: number);
	constructor(
		chars: number,
		buffer: ArrayBuffer,
		byteOffset?: number,
		length?: number,
	);
	constructor(chars: number, arr: Iterable<string>);
	constructor(
		chars: number,
		x: number | ArrayBuffer | Iterable<string>,
		byteOffset?: number,
		length?: number,
	) {
		this.chars = chars;
		if (typeof x === "number") {
			this.#data = new Int32Array(x * chars);
		} else if (x instanceof ArrayBuffer) {
			if (length) length *= chars;
			this.#data = new Int32Array(x, byteOffset, length);
		} else {
			const values = x;
			const d = new UnicodeStringArray(chars, 1);
			this.#data = new Int32Array((function* () {
				for (let str of values) {
					d.set(0, str);
					yield* d.#data;
				}
			})());
		}
		this.#encode_buffer = new Int32Array(chars);
	}

	get BYTES_PER_ELEMENT() {
		return this.#data.BYTES_PER_ELEMENT * this.chars;
	}

	get byteLength() {
		return this.#data.byteLength;
	}

	get byteOffset() {
		return this.#data.byteOffset;
	}

	/** @type {ArrayBuffer} */
	get buffer() {
		return this.#data.buffer;
	}

	/** @type {number} */
	get length() {
		return this.#data.length / this.chars;
	}

	get(idx: number) {
		const offset = this.chars * idx;
		let result = "";
		for (let i = 0; i < this.chars; i++) {
			result += String.fromCodePoint(this.#data[offset + i]);
		}
		return result.replace(/\u0000/g, "");
	}

	set(idx: number, value: string) {
		const offset = this.chars * idx;
		const view = this.#data.subarray(offset, offset + this.chars);
		view.fill(0); // clear current
		for (let i = 0; i < this.chars; i++) {
			view[i] = value.codePointAt(i) ?? 0;
		}
	}

	fill(value: string) {
		// encode once
		this.set(0, value);
		// copy the encoded values to all other elements
		let encoded = this.#data.subarray(0, this.chars);
		for (let i = 1; i < this.length; i++) {
			this.#data.set(encoded, i * this.chars);
		}
	}

	*[Symbol.iterator](): IterableIterator<string> {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}
