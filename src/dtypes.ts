import type { BoolArray, ByteStringArray, UnicodeStringArray } from "./lib/custom-arrays";

/** @category Number */
export type Int8 = "|i1";
/** @category Number */
export type Int16 = ">i2" | "<i2";
/** @category Number */
export type Int32 = ">i4" | "<i4";
/** @category Bigint */
export type Int64 = ">i8" | "<i8";

/** @category Number */
export type Uint8 = "|u1";
/** @category Number */
export type Uint16 = ">u2" | "<u2";
/** @category Number */
export type Uint32 = ">u4" | "<u4";
/** @category Bigint */
export type Uint64 = ">u8" | "<u8";

/** @category Number */
export type Float32 = ">f4" | "<f4";
/** @category Number */
export type Float64 = ">f8" | "<f8";

/** @category Boolean */
export type Bool = "|b1";

/** @category String */
export type UnicodeStr<Bytes extends number = number> = `<U${Bytes}` | `>U${Bytes}`;
/** @category String */
export type ByteStr<Bytes extends number = number> = `|S${Bytes}`;

export type NumericDataType =
	| Int8
	| Int16
	| Int32
	| Uint8
	| Uint16
	| Uint32
	| Float32
	| Float64;
export type BigintDataType = Int64 | Uint64;
export type StringDataType = UnicodeStr | ByteStr;

export type DataType =
	| NumericDataType
	| BigintDataType
	| StringDataType
	| Bool;

export type TypedArray<D extends DataType> = D extends Int8 ? Int8Array
	: D extends Int16 ? Int16Array
	: D extends Int32 ? Int32Array
	: D extends Int64 ? BigInt64Array
	: D extends Uint8 ? Uint8Array
	: D extends Uint16 ? Uint16Array
	: D extends Uint32 ? Uint32Array
	: D extends Uint64 ? BigUint64Array
	: D extends Float32 ? Float32Array
	: D extends Float64 ? Float64Array
	: D extends Bool ? BoolArray
	: D extends `|S${infer _}` ? ByteStringArray
	: D extends `>U${infer _}` ? UnicodeStringArray
	: D extends `<U${infer _}` ? UnicodeStringArray
	: never;

export type TypedArrayConstructor<D extends DataType> = {
	new (length: number): TypedArray<D>;
	new (array: ArrayLike<Scalar<D>> | ArrayBufferLike): TypedArray<D>;
	// TODO: implement for Bool/Unicode arrays
	// new(buffer: ArrayBufferLike, byteOffset?: number, length?: number): TypedArray<D>
	// new(elements: Iterable<Scalar<D>>): TypedArray<D>
};

// Hack to get scalar type since is not defined on any typed arrays.
export type Scalar<D extends DataType> = D extends "|b1" ? boolean
	: D extends `${infer _}${"U" | "S"}${infer _}` ? string
	: D extends `${"<" | ">"}${"u" | "i"}8` ? bigint
	: number;

// TODO: Using this for sanity check, but really should move to formal compilation tests.
type Parts<D extends DataType> = {
	[Key in D]: [TypedArrayConstructor<Key>, TypedArray<Key>, Scalar<Key>];
};
