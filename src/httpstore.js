import { KeyError, Store } from './core.js';

export default class HTTPStore extends Store {
  constructor(url) {
    super();
    this.url = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  _path(key) {
    return `${this.url}/${key.startsWith('/') ? key.slice(1) : key}`;
  }

  async get(key, _default = null) {
    const path = this._path(key);
    const res = await fetch(path);
    if (res.status === 404) {
      if (_default !== null) return _default;
      throw new KeyError(key);
    }
    const value = await res.arrayBuffer();
    return value;
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
