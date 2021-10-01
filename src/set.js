// @ts-check
import { BasicIndexer, set_selection } from './lib/indexing.js';

/**
 * @template {import('./types').DataType} Dtype
 * @template {import('./types').Store} Store
 * @this {import('./hierarchy').ZarrArray<Dtype, Store>}
 *
 * @param {null | (number | import('./types').Slice | null)[]} selection
 * @param {import('./types').TypedArray<Dtype>[0] | import('./types').NDArray<Dtype>} value
 * @returns {Promise<void>}
 */
export function set(selection, value) {
  const indexer = new BasicIndexer({ selection, ...this });
  return set_selection.call(this, indexer, value);
}
