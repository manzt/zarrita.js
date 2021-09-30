// @ts-check
const encoder = new TextEncoder();
/** @param {Record<string, any>} o */
export function json_encode_object(o) {
  const str = JSON.stringify(o, null, 2);
  return encoder.encode(str);
}

const decoder = new TextDecoder();
/** @param {Uint8Array} bytes */
export function json_decode_object(bytes) {
  const str = decoder.decode(bytes);
  return JSON.parse(str);
}

function system_is_little_endian() {
  const a = new Uint32Array([0x12345678]);
  const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  return !(b[0] === 0x12);
}

const LITTLE_ENDIAN_OS = system_is_little_endian();

/** @param {'|' | '<' | '>'} endianness */
export const should_byte_swap = (endianness) => LITTLE_ENDIAN_OS && endianness === '>';

/** @param {import('../types').TypedArray<import('../types').DataType>} src */
export function byte_swap_inplace(src) {
  const b = src.BYTES_PER_ELEMENT;
  const flipper = new Uint8Array(src.buffer, src.byteOffset, src.length * b);
  const numFlips = b / 2;
  const endByteIndex = b - 1;
  let t = 0;
  for (let i = 0; i < flipper.length; i += b) {
    for (let j = 0; j < numFlips; j += 1) {
      t = flipper[i + j];
      flipper[i + j] = flipper[i + endByteIndex - j];
      flipper[i + endByteIndex - j] = t;
    }
  }
}

/**
 * @template T
 * @param {T | T[]} maybe_arr
 * @return {T[]}
 */
export function ensure_array(maybe_arr) {
  return Array.isArray(maybe_arr) ? maybe_arr : [maybe_arr];
}

/** @type {Set<import('../types').DataType>} */
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
 * @template {string} D
 *
 * @param {D} dtype
 * @returns {D extends import('../types').DataType ? D : never}
 */
export function ensure_dtype(dtype) {
  if (!DTYPE_STRS.has(/** @type {any} */ (dtype))) {
    throw new TypeError(`Invalid dtype, got: ${dtype}`);
  }
  return /** @type {any} */ (dtype);
}

/** @param {string} path */
export function normalize_path(path) {
  return path[0] !== '/' ? `/${path}` : path;
}

/** @typedef {typeof DTYPES} DataTypeMapping */
const DTYPES = {
  u1: Uint8Array,
  i1: Int8Array,
  u2: Uint16Array,
  i2: Int16Array,
  u4: Uint32Array,
  i4: Int32Array,
  f4: Float32Array,
  f8: Float64Array,
};

/**
 * @template {import('../types').DataType} Dtype
 *
 * @param {Dtype} dtype
 * @returns {import('../types').ParsedDataType<Dtype>}
 */
export function parse_dtype(dtype) {
  // The type-casting in this function blocks preserves the
  // generic `Dtype` so type inference is more precise to end users.

  // can only be '<' | '>' | '|' for a valid `DataType`. Type inference returns 'string', so we need to cast.
  const endianness = /** @type {import('../types').Endianness<Dtype>} */ (dtype[0]);

  // get last two characters of three character DataType; can only be keyof DTYPES at the moment.
  const key =
    /** @type {import('../types').DataTypeMappingKey<Dtype>} */ (dtype.slice(1));
  const ctr = DTYPES[key];

  // we should be able to use the constructor directly, but TypeScript's built-in TypedArray
  // types return a union of TypedArrays rather than the instance type. The `ParsedDataType`
  // signature will contrain any caller of `create` to call with `ArrayBuffer` or `number`, which
  // are valid overloads for all TypedArray constructors.
  const create = (
    /** @type {any} */ x,
  ) => /** @type {import('../types').TypedArray<Dtype>} */ (new ctr(x));
  return { endianness, ctr, create };
}
