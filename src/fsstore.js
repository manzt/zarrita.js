import fs from 'fs/promises';
import path from 'path';
import { KeyError, ListDirResult, Store, assert } from './core.js';

export default class FileSystemStore extends Store {
  constructor(fp) {
    super();
    this.root = fp;
  }

  async get(key, _default = null) {
    const fp = path.join(this.root, key);
    try {
      const value = await fs.readFile(fp, null);
      return value;
    } catch (err) {
      if (err.code === 'ENOENT') {
        if (_default !== null) return _default;
        throw new KeyError(key);
      }
      throw err;
    }
  }

  async set(key, value) {
    const fp = path.join(this.root, key);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, value, null);
  }

  async delete(key) {
    const fp = path.join(this.root, key);
    await fs.unlink(fp);
    return true;
  }

  async list_prefix(prefix) {
    assert(typeof prefix === 'string', 'Prefix must be a string.');
    assert(prefix[prefix.length-1] === '/', "Prefix must end with '/'.");
    const fp = path.join(this.root, prefix);
    try {
      const items = [];
      for await (const file of _walk(fp)) {
        items.push(file.split(fp)[1]);
      }
      return items;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async list_dir(prefix = '') {
    assert(typeof prefix === 'string', 'Prefix must be a string.');
    if (prefix) {
      assert(prefix[prefix.length - 1] === '/', "Prefix must end with '/'");
    }

    const contents = [];
    const prefixes = []; // could have redundant keys

    const fp = path.join(this.root, prefix);
    try {
      const dir = await fs.readdir(fp, { withFileTypes: true });
      dir.forEach(d => {
        if (d.isFile()) contents.push(d.name);
        if (d.isDirectory()) prefixes.push(d.name); // directory
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return new ListDirResult({ contents: [], prefixes: [] });
      }
      throw err;
    }
    return new ListDirResult({ contents, prefixes });
  }

  keys() {
    return _walk(this.root);
  }

  repr() {
    return path.resolve(this.root);
  }
}

async function* _walk(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* _walk(res);
    } else {
      yield res;
    }
  }
}
