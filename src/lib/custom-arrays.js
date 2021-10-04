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
