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

/** @param {import('../types').TypedArray<import('../types').Dtype>} src */
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

/** @typedef {typeof DTYPES} DtypeMapping */
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
 * @template {import('../types').Dtype} D
 *
 * @param {D} dtype
 * @returns {import('../types').ParsedDtype<D>}
 */
export function parse_dtype(dtype) {
  const endianness = /** @type {import('../types').Endianness<D> */ (dtype[0]);
  const key = /** @type {import('../types').MappingKey<D>} */ (dtype.slice(1));
  const ctr = DTYPES[key];
  return {
    endianness,
    ctr,
    // We should be able to use the constructor directly, but this is a hack
    // to ensure that we get more precise types.
    // @ts-ignore
    create: (x) => new ctr(x),
  };
}
