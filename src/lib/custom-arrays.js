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

export class ByteStringArray {
  bytes = 1;

  /**
   * @param {number | ArrayBuffer} x
   * @param {number} chars
   */
  constructor(x, chars) {
    this.chars = chars;
    if (typeof x === 'number') {
      this.buffer = new ArrayBuffer(this.bytes * x * chars);
    } else {
      this.buffer = x;
    }
  }

  get length() {
    return this.buffer.byteLength / (this.bytes * this.chars);
  }

  /** @param {number} idx */
  get(idx) {
    const view = new DataView(
      this.buffer,
      this.bytes * this.chars * idx,
      this.bytes * this.chars,
    );
    return new TextDecoder().decode(view).replaceAll(/\x00/g, '');
  }

  /**
   * @param {number} idx
   * @param {string} value
   */
  set(idx, value) {
    const encoded = new TextEncoder().encode(value);
    if (encoded.length > this.bytes * this.chars) {
      throw new Error(`UTF-8 encoded string too large: ${value}`);
    }
    const view = new DataView(
      this.buffer,
      this.bytes * this.chars * idx,
      this.bytes * this.chars,
    );
    for (let i = 0; i < this.bytes * this.chars; i++) {
      view.setUint8(i, encoded[i] ?? 0);
    }
  }

  array() {
    return Array.from({ length: this.length }).map((_, idx) => this.get(idx));
  }
}

export class UnicodeStringArray extends ByteStringArray {
  bytes = 4;
}
