export class BoolArray {
	/** @type {Uint8Array} */
	#bytes;

	/**
	 * @constructor
	 * @overload
	 * @param {number} size
	 *
	 * @constructor
	 * @overload
	 * @param {ArrayBuffer} buffer
	 * @param {number=} byteOffset
	 * @param {number=} length
	 *
	 * @constructor
	 * @overload
	 * @param {Iterable<boolean>} arr
	 *
	 * @constructor
	 * @param {number | Iterable<boolean> | ArrayBuffer} x
	 * @param {number} [byteOffset]
	 * @param {number} [length]
	 */
	constructor(x, byteOffset, length) {
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

	/**
	 * @param {number} idx
	 * @returns {boolean}
	 */
	get(idx) {
		let value = this.#bytes[idx];
		return typeof value === "number" ? value !== 0 : value;
	}

	/**
	 * @param {number} idx
	 * @param {boolean} value
	 * @returns {void}
	 */
	set(idx, value) {
		this.#bytes[idx] = value ? 1 : 0;
	}

	/**
	 * @param {boolean} value
	 * @returns {void}
	 */
	fill(value) {
		this.#bytes.fill(value ? 1 : 0);
	}

	/**
	 * @returns {IterableIterator<boolean>}
	 */
	*[Symbol.iterator]() {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

export class ByteStringArray {
	/** @type {Uint8Array} */
	_data;

	/**
	 * @constructor
	 * @overload
	 * @param {number} chars
	 * @param {number} size
	 *
	 * @constructor
	 * @overload
	 * @param {number} chars
	 * @param {ArrayBuffer} buffer
	 * @param {number=} byteOffset
	 * @param {number=} length
	 *
	 * @constructor
	 * @overload
	 * @param {number} chars
	 * @param {Iterable<string>} arr
	 *
	 * @constructor
	 * @param {number} chars
	 * @param {number | ArrayBuffer | Iterable<string>} x
	 * @param {number=} byteOffset
	 * @param {number=} length
	 */
	constructor(chars, x, byteOffset, length) {
		this.chars = chars;
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

	/**
	 * @param {number} idx
	 * @returns {string}
	 */
	get(idx) {
		const view = new Uint8Array(
			this.buffer,
			this.byteOffset + this.chars * idx,
			this.chars,
		);
		return new TextDecoder().decode(view).replace(/\x00/g, "");
	}

	/**
	 * @private
	 *
	 * @param {string} s
	 * @returns {Uint8Array}
	 */
	_encode(s) {
		return new TextEncoder().encode(s);
	}

	/**
	 * @param {number} idx
	 * @param {string} value
	 * @returns {void}
	 */
	set(idx, value) {
		const view = new Uint8Array(
			this.buffer,
			this.byteOffset + this.chars * idx,
			this.chars,
		);
		view.fill(0); // clear current
		view.set(this._encode(value));
	}

	/**
	 * @param {string} value
	 * @returns {void}
	 */
	fill(value) {
		const encoded = this._encode(value);
		for (let i = 0; i < this.length; i++) {
			this._data.set(encoded, i * this.chars);
		}
	}

	/** @returns {IterableIterator<string>} */
	*[Symbol.iterator]() {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}

export class UnicodeStringArray {
	/** @type {Int32Array} */
	_data;

	/**
	 * @constructor
	 * @overload
	 * @param {number} chars
	 * @param {number} size
	 *
	 * @constructor
	 * @overload
	 * @param {number} chars
	 * @param {ArrayBuffer} buffer
	 * @param {number=} byteOffset
	 * @param {number=} length
	 *
	 * @constructor
	 * @overload
	 * @param {number} chars
	 * @param {Iterable<string>} arr
	 *
	 * @constructor
	 * @param {number} chars
	 * @param {number | ArrayBuffer | Iterable<string>} x
	 * @param {number} [byteOffset]
	 * @param {number} [length]
	 */
	constructor(chars, x, byteOffset, length) {
		this.chars = chars;
		if (typeof x === "number") {
			this._data = new Int32Array(x * chars);
		} else if (x instanceof ArrayBuffer) {
			if (length) length *= chars;
			this._data = new Int32Array(x, byteOffset, length);
		} else {
			const values = x;
			const encode = this._encode.bind(this);
			this._data = new Int32Array((function* () {
				for (let str of values) {
					let int32 = encode(str);
					yield* int32;
				}
			})());
		}
	}

	get BYTES_PER_ELEMENT() {
		return this.chars * this._data.BYTES_PER_ELEMENT;
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
		return this._data.length / this.chars;
	}

	/**
	 * @private
	 *
	 * @param {string} s
	 * @returns {Int32Array}
	 */
	_encode(s) {
		let out = new Int32Array(this.chars);
		for (let i = 0; i < this.chars; i++) {
			out[i] = s.codePointAt(i) ?? 0;
		}
		return out;
	}

	/**
	 * @param {number} idx
	 * @returns {string}
	 */
	get(idx) {
		const offset = this.chars * idx;
		let result = "";
		for (let i = 0; i < this.chars; i++) {
			result += String.fromCodePoint(this._data[offset + i]);
		}
		return result.replace(/\u0000/g, "");
	}

	/**
	 * @param {number} idx
	 * @param {string} value
	 * @returns {void}
	 */
	set(idx, value) {
		const offset = this.chars * idx;
		const view = this._data.subarray(offset, offset + this.chars);
		view.fill(0); // clear current
		view.set(this._encode(value));
	}

	/**
	 * @param {string} value
	 * @returns {void}
	 */
	fill(value) {
		const encoded = this._encode(value);
		for (let i = 0; i < this.length; i++) {
			this._data.set(encoded, i * this.chars);
		}
	}

	/** @returns {IterableIterator<string>} */
	*[Symbol.iterator]() {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}
