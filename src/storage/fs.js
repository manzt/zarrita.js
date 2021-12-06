// @ts-check
import * as fs from 'fs';
import * as path from 'path';

import { assert } from '../lib/errors.js';

/**
 * @typedef {import('../types').AsyncStore} AsyncStore
 * @implements {AsyncStore}
 */
class FileSystemStore {
  /** @param {string} fp */
  constructor(fp) {
    this.root = fp;
  }

  /** @param {string} key */
  get(key) {
    const fp = path.join(this.root, key);
    return fs.promises.readFile(fp)
      .then((buf) => new Uint8Array(buf.buffer))
      .catch((err) => {
        // return undefined is no file or directory
        if (err.code === 'ENOENT') return undefined;
        throw err;
      });
  }

  /** @param {string} key */
  has(key) {
    const fp = path.join(this.root, key);
    return fs.promises.access(fp).then((_) => true).catch((_) => false);
  }

  /**
   * @param {string} key
   * @param {Uint8Array} value
   */
  async set(key, value) {
    const fp = path.join(this.root, key);
    await fs.promises.mkdir(path.dirname(fp), { recursive: true });
    await fs.promises.writeFile(fp, value, null);
  }

  /** @param {string} key */
  async delete(key) {
    const fp = path.join(this.root, key);
    await fs.promises.unlink(fp);
    return true;
  }

  /** @param {string} prefix */
  async list_prefix(prefix) {
    assert(typeof prefix === 'string', 'Prefix must be a string.');
    assert(
      prefix[prefix.length - 1] === '/',
      'Prefix must end with \'/\'.',
    );
    const fp = path.join(this.root, prefix);
    try {
      const items = [];
      for await (const file of walk(fp)) {
        items.push(file.split(fp)[1]);
      }
      return items;
    } catch (/** @type {any} */ err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  /** @param {string} prefix */
  async list_dir(prefix = '') {
    assert(typeof prefix === 'string', 'Prefix must be a string.');
    if (prefix) {
      assert(
        prefix[prefix.length - 1] === '/',
        'Prefix must end with \'/\'',
      );
    }

    /** @type {string[]} */
    const contents = [];
    /** @type {string[]} */
    const prefixes = []; // could have redundant keys

    const fp = path.join(this.root, prefix);
    try {
      const dir = await fs.promises.readdir(fp, { withFileTypes: true });
      dir.forEach((d) => {
        if (d.isFile()) contents.push(d.name);
        if (d.isDirectory()) prefixes.push(d.name); // directory
      });
    } catch (/** @type {any} */ err) {
      if (err.code === 'ENOENT') {
        return { contents: [], prefixes: [] };
      }
      throw err;
    }
    return { contents, prefixes };
  }
}

/**
 * @param {string} dir
 * @returns {AsyncGenerator<string>}
 */
async function* walk(dir) {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      yield* walk(res);
    } else {
      yield res;
    }
  }
}

export default FileSystemStore;
