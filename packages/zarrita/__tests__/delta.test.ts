import { describe, expect, test } from "vitest";
import { DeltaCodec } from "../src/codecs/delta.js";

function makeChunk<T extends ArrayBufferView & { length: number }>(data: T) {
  return { data, shape: [data.length], stride: [1] };
}

describe("DeltaCodec", () => {
  test("roundtrip int32", () => {
    const codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
    const original = makeChunk(new Int32Array([10, 12, 15, 19, 24]));
    const encoded = codec.encode(original);
    const decoded = codec.decode(encoded);
    expect(decoded.data).toStrictEqual(original.data);
  });

  test("roundtrip float64", () => {
    const codec = DeltaCodec.fromConfig({}, { data_type: "float64" });
    const original = makeChunk(new Float64Array([0.5, 1.5, 3.0, 6.0, 10.0]));
    const encoded = codec.encode(original);
    const decoded = codec.decode(encoded);
    expect(decoded.data).toStrictEqual(original.data);
  });

  test("encode produces differences", () => {
    const codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
    const chunk = makeChunk(new Int32Array([10, 12, 15, 19, 24]));
    const encoded = codec.encode(chunk);
    expect(encoded.data).toStrictEqual(new Int32Array([10, 2, 3, 4, 5]));
  });

  test("shape and stride are preserved", () => {
    const codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
    const chunk = {
      data: new Int32Array([1, 2, 3, 4, 5, 6]),
      shape: [2, 3],
      stride: [3, 1],
    };
    const encoded = codec.encode(chunk);
    expect(encoded.shape).toStrictEqual([2, 3]);
    expect(encoded.stride).toStrictEqual([3, 1]);
    const decoded = codec.decode(encoded);
    expect(decoded.data).toStrictEqual(chunk.data);
  });

  test("throws for unsupported data type", () => {
    expect(() =>
      DeltaCodec.fromConfig({}, { data_type: "bool" as never }),
    ).toThrow();
  });

  test("int8 overflow wraps (two's complement, matches numpy)", () => {
    // diff of -100 - 100 = -200, which overflows int8 and wraps to 56
    const codec = DeltaCodec.fromConfig({}, { data_type: "int8" });
    const chunk = makeChunk(new Int8Array([100, -100]));
    const encoded = codec.encode(chunk);
    expect(encoded.data).toStrictEqual(new Int8Array([100, 56]));
    expect(codec.decode(encoded).data).toStrictEqual(chunk.data);
  });

  test("int32 overflow wraps at boundary (matches numpy)", () => {
    // MAX_INT32 -> MIN_INT32: diff = 1 (wraps around)
    const codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
    const chunk = makeChunk(new Int32Array([2147483647, -2147483648]));
    const encoded = codec.encode(chunk);
    expect(encoded.data).toStrictEqual(new Int32Array([2147483647, 1]));
    expect(codec.decode(encoded).data).toStrictEqual(chunk.data);
  });

  test("float32 overflow stays as Infinity (IEEE 754, matches numpy)", () => {
    // diff of -1e38 - 1e38 = -2e38 (within float32 range, round-trips)
    const codec = DeltaCodec.fromConfig({}, { data_type: "float32" });
    const chunk = makeChunk(new Float32Array([1e38, -1e38]));
    expect(codec.decode(codec.encode(chunk)).data).toStrictEqual(chunk.data);
    // inf - inf = NaN, which propagates
    const infChunk = makeChunk(new Float32Array([Infinity, Infinity]));
    const encoded = codec.encode(infChunk);
    expect(encoded.data[0]).toBe(Infinity);
    expect(encoded.data[1]).toBeNaN();
  });

  test("F-order (stride [1,3]): delta operates on linear memory, strides pass through unchanged", () => {
    // Simulates what TransposeCodec([1,0]) produces before DeltaCodec during decode:
    // data is in C-order memory [1..9] but stride [1,3] maps it as a column-major 3x3 matrix.
    const codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
    const chunk = {
      data: new Int32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      shape: [3, 3],
      stride: [1, 3],
    };
    const encoded = codec.encode(chunk);
    // delta operates on linear memory [1,2,...,9], not on logical (strided) order
    expect(encoded.data).toStrictEqual(
      new Int32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
    );
    expect(encoded.stride).toStrictEqual([1, 3]);
    expect(codec.decode(encoded).data).toStrictEqual(chunk.data);
  });

  test("throws for non-C/Fortran strides", () => {
    const codec = DeltaCodec.fromConfig({}, { data_type: "int32" });
    const chunk = {
      data: new Int32Array(27),
      shape: [3, 3, 3],
      stride: [3, 9, 1], // neither C [9,3,1] nor F [1,3,9]
    };
    expect(() => codec.encode(chunk)).toThrow();
    expect(() => codec.decode(chunk)).toThrow();
  });
});
