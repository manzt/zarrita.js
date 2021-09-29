export * from './v3.js';
export { ExplicitGroup, ImplicitGroup, ZarrArray } from './hierarchy.js';
export { slice } from './lib/indexing.js';
export { registry } from './registry.js';

import { ZarrArray } from './hierarchy.js';
import { BasicIndexer, get_selection, set_selection } from './lib/indexing.js';

// This module mutates the ZarrArray prototype to add chunk indexing and slicing

Object.defineProperties(ZarrArray.prototype, {
  get: {
    value(selection) {
      const indexer = new BasicIndexer({ selection, ...this });
      return get_selection.call(this, indexer);
    },
  },
  set: {
    value(selection, value) {
      const indexer = new BasicIndexer({ selection, ...this });
      return set_selection.call(this, indexer, value);
    },
  },
});
