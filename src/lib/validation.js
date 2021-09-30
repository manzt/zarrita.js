// @ts-check

/** @typedef {import('../types').Dtype} Dtype */

const ALLOWED_NODE_NAME_CHARS = new Set(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ._-',
);

/** @param {string} path */
export function check_path(path) {
  if (path.length === 0) {
    throw new TypeError('Path cannot be empty string.');
  }

  if (path[0] !== '/') {
    // handle relative paths, treat as relative to the root, for user convenience
    path = '/' + path;
  }

  if (path.length > 1) {
    const segments = path.slice(1).split('/');
    for (const segment of segments) {
      if (segment.length === 0) {
        throw new TypeError('Path segment cannot be empty string.');
      }
      for (const c of segment) {
        if (!ALLOWED_NODE_NAME_CHARS.has(c)) {
          throw new TypeError(`Invalid Zarr path character: ${c}.`);
        }
      }
      if (segment.split('').every((c) => c === '.')) {
        throw new TypeError('Path cannot be empty.');
      }
    }
  }
  return path;
}

/**
 * @param {number | number[]} shape
 * @returns {number[]}
 */
export function check_shape(shape) {
  if (typeof shape === 'number') {
    shape = [shape];
  }
  if (!shape.every((i) => Number.isInteger(i))) {
    throw new TypeError(`Invalid array shape, got: ${shape}`);
  }
  return shape;
}

/** @type {Set<Dtype>} */
const DTYPE_STRS = new Set([
  '|i1',
  '|u1',
  '<i2',
  '<i4',
  '>i2',
  '>i4',
  '<u2',
  '<u4',
  '>u2',
  '>u4',
  '<f4',
  '<f8',
  '>f4',
  '>f8',
]);

/**
 * @param {any} value
 * @returns {value is Dtype}
 */
const isDtype = (value) => DTYPE_STRS.has(value);

/**
 * @template {string} D
 *
 * @param {D} dtype
 * @returns {D extends Dtype ? D : never}
 */
export function check_dtype(dtype) {
  if (!isDtype(dtype)) {
    throw new TypeError(`Invalid dtype, got: ${dtype}`);
  }
  // @ts-ignore
  return dtype;
}

/**
 * @param {number | number[]} chunk_shape
 * @param {number[]} shape
 * @returns {number[]}
 */
export function check_chunk_shape(chunk_shape, shape) {
  if (typeof chunk_shape === 'number') {
    chunk_shape = [chunk_shape];
  }
  if (chunk_shape.length !== shape.length) {
    throw new TypeError('chunk_shape and shape have different dim sizes.');
  }
  return chunk_shape;
}
