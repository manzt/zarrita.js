// @ts-check
/** @typedef {import('../types').AsyncStore} Store */

/**
 * @template {string} Url
 * @implements {Store}
 */
class HTTPStore {
  /** @param {Url} url */
  constructor(url) {
    this.url = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  /** @param {string} key */
  _path(key) {
    return `${this.url}/${key.startsWith('/') ? key.slice(1) : key}`;
  }

  /**
   * @param {string} key
   * @returns {Promise<Uint8Array | undefined>}
   */
  async get(key) {
    const path = this._path(key);
    const res = await fetch(path);
    if (res.status === 404 || res.status === 403) {
      return undefined;
    }
    const value = await res.arrayBuffer();
    return new Uint8Array(value);
  }

  /** @param {string} key */
  has(key) {
    return this.get(key).then((res) => res !== undefined);
  }

  /**
   * @param {string} _key
   * @param {Uint8Array} _value
   * @return {never}
   */
  set(_key, _value) {
    throw new Error('HTTPStore is read-only.');
  }

  /**
   * @param {string} _key
   * @returns {never}
   */
  delete(_key) {
    throw new Error('HTTPStore is read-only.');
  }

  list_prefix() {
    return Promise.resolve([]);
  }

  list_dir() {
    return Promise.resolve({ contents: [], prefixes: [] });
  }
}

export default HTTPStore;
