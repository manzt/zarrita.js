// @ts-check
import { BasicIndexer, get_selection } from './lib/indexing.js';

/**
 * @template {import('./types').DataType} Dtype
 * @template {import('./types').Store} Store
 * @this {import('./hierarchy').ZarrArray<Dtype, Store>}
 *
 * @template {null | (number | import('./types').Slice | null)[]} S
 * @param {S} selection */
export function get(selection) {
  const indexer = new BasicIndexer({ selection, ...this });
  return get_selection.call(this, indexer);
}
