import { NotImplementedError } from '../lib/errors.js';

import type { Store } from '../core.js';

export default class HTTPStore implements Store {
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
    if (res.status === 404) {
      return;
    }
    const value = await res.arrayBuffer();
    return new Uint8Array(value);
  }

  set(key: string, value: Uint8Array) {
    throw new NotImplementedError('HTTPStore is read-only.');
    return;
  }

  delete(key: string) {
    throw new NotImplementedError('HTTPStore is read-only.');
    return false;
  }

  *keys() {
    return;
  }

  list_prefix() {
    return [];
  }

  list_dir() {
    return { contents: [], prefixes: [] };
  }

  repr() {
    return this.url;
  }
}
