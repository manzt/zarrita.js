import { NotImplementedError } from '../lib/errors.js';
import type { AsyncStore } from '../core.js';

export default class HTTPStore implements AsyncStore {
  url: string;

  constructor(url: string) {
    this.url = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  _path(key: string) {
    return `${this.url}/${key.startsWith('/') ? key.slice(1) : key}`;
  }

  async get(key: string) {
    const path = this._path(key);
    const res = await fetch(path);
    if (res.status === 200) {
      // only decode if 200
      const value = await res.arrayBuffer();
      return new Uint8Array(value);
    } else if (res.status !== 404) {
      // throw error if not 404
      throw new Error(`HTTP Error: key=${path}, status=${res.status}.`)
    }
    // 404 returns undefined
  }

  // @ts-ignore
  set(key: string, value: Uint8Array) {
    throw new NotImplementedError('HTTPStore is read-only.');
  }

  // @ts-ignore
  async delete(key: string) {
    throw new NotImplementedError('HTTPStore is read-only.');
  }

  async *keys() {
    return;
  }

  async list_prefix() {
    return [];
  }

  async list_dir() {
    return { contents: [], prefixes: [] };
  }

  repr() {
    return this.url;
  }
}
