import type { Chunk, BigintDataType, NumberDataType } from "../metadata.js";
import { get_ctr } from "../util.js";

type DeltaCompatibleType = NumberDataType | BigintDataType;

const SUPPORTED: ReadonlySet<string> = new Set<DeltaCompatibleType>([
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
  "float16",
  "float32",
  "float64",
]);

export class DeltaCodec<D extends DeltaCompatibleType> {
  kind = "array_to_array" as const;
  #ctr: ReturnType<typeof get_ctr<D>>;

  constructor(ctr: ReturnType<typeof get_ctr<D>>) {
    this.#ctr = ctr;
  }

  static fromConfig<D extends DeltaCompatibleType>(
    _config: unknown,
    meta: { data_type: D },
  ): DeltaCodec<D> {
    if (!SUPPORTED.has(meta.data_type))
      throw new Error(
        `Delta codec does not support data type: ${meta.data_type}`,
      );
    return new DeltaCodec(get_ctr(meta.data_type));
  }

  encode(chunk: Chunk<D>): Chunk<D> {
    const src = chunk.data;
    const out = new this.#ctr(src.length) as Chunk<D>["data"];
    out[0] = src[0];
    for (let i = 1; i < src.length; i++) {
      // @ts-expect-error - mix of bigint and number always safe to subtract
      out[i] = src[i] - src[i - 1];
    }
    return { data: out, shape: chunk.shape, stride: chunk.stride };
  }

  decode(chunk: Chunk<D>): Chunk<D> {
    const src = chunk.data;
    const out = new this.#ctr(src.length) as Chunk<D>["data"];
    out[0] = src[0];
    for (let i = 1; i < src.length; i++) {
      // @ts-expect-error - mix of bigint and number always safe to add
      out[i] = out[i - 1] + src[i];
    }
    return { data: out, shape: chunk.shape, stride: chunk.stride };
  }
}
