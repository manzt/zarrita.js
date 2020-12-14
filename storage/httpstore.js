import { KeyError, NotImplementedError } from '../lib/errors.js';
export default class HTTPStore {
    constructor(url) {
        this.url = url.endsWith('/') ? url.slice(0, -1) : url;
    }
    _path(key) {
        return `${this.url}/${key.startsWith('/') ? key.slice(1) : key}`;
    }
    async get(key, _default) {
        const path = this._path(key);
        const res = await fetch(path);
        if (res.status === 404) {
            if (_default)
                return _default;
            throw new KeyError(key);
        }
        const value = await res.arrayBuffer();
        return new Uint8Array(value);
    }
    set(key, value) {
        throw new NotImplementedError('HTTPStore is read-only.');
        return;
    }
    delete(key) {
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
