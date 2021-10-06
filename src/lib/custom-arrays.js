// @ts-check

export class BoolArray {
  /** @param {number | ArrayBuffer} x */
  constructor(x) {
    this._bytes = new Uint8Array(/** @type {any} */ (x));
  }

  get buffer() {
    return this._bytes.buffer;
  }

  get length() {
    return this._bytes.length;
  }

  /** @param {number} idx */
  get(idx) {
    return this._bytes[idx] === 1;
  }

  /**
   * @param {number} idx
   * @param {boolean} value
   */
  set(idx, value) {
    this._bytes[idx] = value ? 1 : 0;
  }

  /** @param {boolean} value */
  fill(value) {
    this._bytes.fill(value ? 1 : 0);
  }

  array() {
    return Array.from(this._bytes).map((b) => b === 1);
  }
}

/**
 * @param {string} str
 * @param {number} bytes
 * @param {number} chars
 */
function encode_str(str, bytes, chars) {
  const encoded = new TextEncoder().encode(str);
  if (encoded.length > bytes * chars) {
    throw new Error(`UTF-8 encoded string too large: ${str}`);
  }
  return encoded;
}

/**
 * @template {number} Bytes
 * @template {number} Chars
 */
export class StringArray {
  /**
   * @param {number | ArrayBuffer} x
   * @param {Bytes} bytes
   * @param {Chars} chars
   */
  constructor(x, bytes, chars) {
    this.chars = chars;
    this.bytes = bytes;
    if (typeof x === 'number') {
      this._bytes = new Uint8Array(bytes * x * chars);
    } else {
      this._bytes = new Uint8Array(x);
    }
  }

  get buffer() {
    return this._bytes.buffer;
  }

  get length() {
    return this._bytes.buffer.byteLength / (this.bytes * this.chars);
  }

  /** @param {number} idx */
  get(idx) {
    const view = new DataView(
      this.buffer,
      this.bytes * this.chars * idx,
      this.bytes * this.chars,
    );
    return new TextDecoder().decode(view).replace(/\x00/g, '');
  }

  /**
   * @param {number} idx
   * @param {string} value
   */
  set(idx, value) {
    const view = new Uint8Array(
      this.buffer,
      this.bytes * this.chars * idx,
      this.bytes * this.chars,
    );
    view.fill(0); // clear current
    view.set(encode_str(value, this.bytes, this.chars));
  }

  /** @param {string} value */
  fill(value) {
    const encoded = encode_str(value, this.bytes, this.chars);
    this._bytes.fill(0);
    for (let i = 0; i < this.length; i++) {
      this._bytes.set(encoded, i * this.bytes * this.chars);
    }
  }

  array() {
    return Array.from({ length: this.length }).map((_, idx) => this.get(idx));
  }
}

/**
 * @template {number} Chars
 * @extends {StringArray<1, Chars>}
 */
export class ByteStringArray extends StringArray {
  /**
   * @param {number | ArrayBuffer} x
   * @param {Chars} chars
   */
  constructor(x, chars) {
    super(x, 1, chars);
  }
}

/**
 * @template {number} Chars
 * @extends {StringArray<4, Chars>}
 */
export class UnicodeStringArray extends StringArray {
  /**
   * @param {number | ArrayBuffer} x
   * @param {Chars} chars
   */
  constructor(x, chars) {
    super(x, 4, chars);
  }
}
