// @ts-check
/** @typedef {import('../types').DataType} DataType */
/** @typedef {import('../types').WithoutEndianness} WithoutEndianness */
/** @typedef {import('../types').Store} Store */

/**
 * @template {DataType | WithoutEndianness } Str
 * @template {DataType} D
 * @template {Store} S
 *
 * @param {import('./hierarchy').ZarrArray<D, S>} arr
 * @param {Str} str
 * @returns {arr is import('./hierarchy').ZarrArray<Extract<Str | `${'<' | '>' | '|'}${Str}`, D>, S>}
 */
export const is = (arr, str) => {
  // Caution! this is very sensitive to the data-type strings!
  return arr.dtype === /** @type {DataType} */ (str) || arr.dtype.slice(1) === str;
};

/**
 * @template {DataType} Dtype
 * @template {Store} S
 * @param {import('./hierarchy').ZarrArray<Dtype, S>} arr
 * @returns {arr is import('./hierarchy').ZarrArray<Exclude<Dtype, import('../types').StringDataType | '|b1'>, S>}
 */
export const is_numeric = (arr) => {
  return (arr.dtype !== '|b1' && !arr.dtype.includes('U') && !arr.dtype.includes('S'));
};
