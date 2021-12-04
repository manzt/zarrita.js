import ReadOnlyStore from './readonly.js';

/** @template {string} Url */
class FetchStore extends ReadOnlyStore {
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
}

export default FetchStore;
