// @ts-check
import { assert } from '../lib/errors.js';

/**
 * @typedef {import('../types').Store} Store
 *
 * @extends {Map<string, Uint8Array>}
 * @implements {Store}
 */
export class MemoryStore extends Map {
  /** @param {string} prefix */
  list_prefix(prefix) {
    assert(typeof prefix === 'string', 'Prefix must be a string.');
    assert(
      prefix[prefix.length - 1] === '/',
      'Prefix must end with \'/\'.',
    );
    const items = [];
    for (const path of super.keys()) {
      if (path.startsWith(prefix)) {
        items.push(path.split(prefix)[1]);
      }
    }
    return items;
  }

  /** @param {string} prefix */
  list_dir(prefix = '') {
    assert(typeof prefix === 'string', 'Prefix must be a string.');
    if (prefix) {
      assert(
        prefix[prefix.length - 1] === '/',
        'Prefix must end with \'/\'',
      );
    }

    const contents = [];
    /** @type {Set<string>} */
    const prefixes = new Set();

    for (const path of super.keys()) {
      if (path.includes(prefix)) {
        const name = prefix ? path.split(prefix)[1] : path;
        const segments = name.split('/');
        const item = segments[0];
        if (segments.length === 1) {
          // file
          contents.push(item);
        } else {
          prefixes.add(item);
        }
      }
    }

    return { contents, prefixes: [...prefixes] };
  }
}
