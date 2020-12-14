export * from './core.js';
export { slice } from './lib/indexing.js';

import { ZarrArray } from './core.js';
import { _BasicIndexer, _get_selection, _set_selection } from './lib/indexing.js';

import type { Slice, NDArray } from './core.js';

// This module mutates the ZarrArray prototype to add chunk indexing and slicing

Object.defineProperties(ZarrArray.prototype, {
  get: {
    value(selection: null | (null | number | Slice)[]): Promise<number | NDArray> {
      return this.get_basic_selection(selection);
    },
  },
  get_basic_selection: {
    value(selection: null | (null | number | Slice)[]): Promise<number | NDArray> {
      const indexer = new _BasicIndexer({ selection, ...this });
      return _get_selection.call(this, indexer);
    },
  },
  set: {
    value(selection: null | (null | number | Slice)[], value: number | NDArray): Promise<void> {
      return this.set_basic_selection(selection, value);
    },
  },
  set_basic_selection: {
    value(selection: null | (null | number | Slice)[], value: number | NDArray): Promise<void> {
      const indexer = new _BasicIndexer({ selection, ...this });
      return _set_selection.call(this, indexer, value);
    },
  },
});
