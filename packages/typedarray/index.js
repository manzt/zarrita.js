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
	 *
	 * @constructor
	 * @param {number | ArrayBuffer} x
	 */
	constructor(x) {
		this.#bytes = new Uint8Array(/** @type {any} */ (x));
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
		return this.#bytes[idx] === 1;
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
	#bytes;

	/**
	 * @constructor
	 * @overload
	 * @param {number} size
	 * @param {number} chars
	 *
	 * @constructor
	 * @overload
	 * @param {ArrayBuffer} buffer
	 * @param {number} chars
	 *
	 * @constructor
	 * @param {number | ArrayBuffer} x
	 * @param {number} chars
	 */
	constructor(x, chars) {
		// @ts-expect-error typescript doesn't like the overloads
		this.#bytes = new Uint8Array(typeof x === "number" ? x * chars : x);
		this.chars = chars;
	}

	/** @type {ArrayBuffer} */
	get buffer() {
		return this.#bytes.buffer;
	}

	/** @type {number} */
	get length() {
		return this.#bytes.buffer.byteLength / this.chars;
	}

	/**
	 * @param {number} idx
	 * @returns {string}
	 */
	get(idx) {
		const view = new Uint8Array(
			this.buffer,
			this.chars * idx,
			this.chars,
		);
		return new TextDecoder().decode(view).replace(/\x00/g, "");
	}

	/**
	 * @param {string} s
	 * @returns {Uint8Array}
	 */
	#encode(s) {
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
			this.chars * idx,
			this.chars,
		);
		view.fill(0); // clear current
		view.set(this.#encode(value));
	}

	/**
	 * @param {string} value
	 * @returns {void}
	 */
	fill(value) {
		const encoded = this.#encode(value);
		for (let i = 0; i < this.length; i++) {
			this.#bytes.set(encoded, i * this.chars);
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
	#data;
	BYTES_PER_ELEMENT = 4;
	byteOffset = 0;

	/**
	 * @constructor
	 * @overload
	 * @param {number} size
	 * @param {number} chars
	 *
	 * @constructor
	 * @overload
	 * @param {ArrayBuffer} buffer
	 * @param {number} chars
	 *
	 * @constructor
	 * @param {number | ArrayBuffer} x
	 * @param {number} chars
	 */
	constructor(x, chars) {
		// @ts-expect-error
		this.#data = new Int32Array(typeof x === "number" ? x * chars : x);
		this.chars = chars;
	}

	/** @type {ArrayBuffer} */
	get buffer() {
		return this.#data.buffer;
	}

	/** @type {number} */
	get length() {
		return this.#data.length / this.chars;
	}

	/**
	 * @param {string} s
	 * @returns {Int32Array}
	 */
	#encode(s) {
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
			result += String.fromCodePoint(this.#data[offset + i]);
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
		const view = this.#data.subarray(offset, offset + this.chars);
		view.fill(0); // clear current
		view.set(this.#encode(value));
	}

	/**
	 * @param {string} value
	 * @returns {void}
	 */
	fill(value) {
		const encoded = this.#encode(value);
		for (let i = 0; i < this.length; i++) {
			this.#data.set(encoded, i * this.chars);
		}
	}

	/** @returns {IterableIterator<string>} */
	*[Symbol.iterator]() {
		for (let i = 0; i < this.length; i++) {
			yield this.get(i);
		}
	}
}
