import fs from 'fs/promises';
import path from 'path';
import { assert } from '../lib/errors.js';

import type { Store } from '../core.js';

export default class FileSystemStore implements Store {
  root: string;

  constructor(fp: string) {
    this.root = fp;
  }

  async get(key: string) {
    const fp = path.join(this.root, key);
    try {
      const value = await fs.readFile(fp, null);
      return value as Uint8Array;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return undefined;
      }
      throw err;
    }
  }

  async set(key: string, value: Uint8Array) {
    const fp = path.join(this.root, key);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, value, null);
  }

  async delete(key: string) {
    const fp = path.join(this.root, key);
    await fs.unlink(fp);
    return true;
  }

  async list_prefix(prefix: string) {
    assert(typeof prefix === 'string', 'Prefix must be a string.');
    assert(prefix[prefix.length - 1] === '/', "Prefix must end with '/'.");
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

    const contents: string[] = [];
    const prefixes: string[] = []; // could have redundant keys

    const fp = path.join(this.root, prefix);
    try {
      const dir = await fs.readdir(fp, { withFileTypes: true });
      dir.forEach(d => {
        if (d.isFile()) contents.push(d.name);
        if (d.isDirectory()) prefixes.push(d.name); // directory
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return { contents: [], prefixes: [] };
      }
      throw err;
    }
    return { contents, prefixes };
  }

  keys() {
    return _walk(this.root);
  }

  repr() {
    return path.resolve(this.root);
  }
}

async function* _walk(dir: string): AsyncGenerator<string> {
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
