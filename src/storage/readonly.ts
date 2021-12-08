// @ts-check
/** @typedef {import('../types').AsyncStore} Store */

/** @implements {Omit<Store, 'get' | 'has'>} */
class ReadOnlyStore {

  /**
   * @param {string} _key
   * @param {Uint8Array} _value
   * @return {never}
   */
  set(_key, _value) {
    throw new Error('Store is read-only.');
  }

  /**
   * @param {string} _key
   * @returns {never}
   */
  delete(_key) {
    throw new Error('Store is read-only.');
  }

  list_prefix() {
    return Promise.resolve([]);
  }

  list_dir() {
    return Promise.resolve({ contents: [], prefixes: [] });
  }
}

export default ReadOnlyStore;
