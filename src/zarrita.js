export * from './core.js';
export { slice } from './indexing.js';

import { ZarrArray } from './core.js';
import { _BasicIndexer, _get_selection, _set_selection } from './indexing.js';

// This module mutates the ZarrArray prototype to add chunk indexing and slicing

Object.defineProperties(ZarrArray.prototype, {
  get: {
    value(selection) {
      return this.get_basic_selection(selection);
    },
  },
  get_basic_selection: {
    value(selection) {
      const indexer = new _BasicIndexer({ selection, ...this });
      return _get_selection.call(this, indexer);
    },
  },
  set: {
    value(selection, value) {
      return this.set_basic_selection(selection, value);
    },
  },
  set_basic_selection: {
    value(selection, value) {
      const indexer = new _BasicIndexer({ selection, ...this });
      return _set_selection.call(this, indexer, value);
    },
  },
});
