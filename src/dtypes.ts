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

export type WithoutEndianness = DataType extends `${infer _}${infer Rest}` ? Rest : never;

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
	: D extends `|S${infer B}` ? ByteStringArray<ParseNumber<B>>
	: D extends `>U${infer B}` ? UnicodeStringArray<ParseNumber<B>>
	: D extends `<U${infer B}` ? UnicodeStringArray<ParseNumber<B>>
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

// Hack to statically infer sizing of string
// TODO: use this implemention when tail recursion is better.
// type Range<
// 	N extends number,
// 	Result extends Array<unknown> = [],
// > = (Result["length"] extends N ? Result
// 	: Range<N, [...Result, Result["length"]]>);
//
// type MAX_SIZE = 256;
// type NumRange = Range<MAX_SIZE>;

//deno-fmt-ignore
type NumRange = [
	  0,   1,   2,   3,   4,   5,   6,   7,   8,   9,  10,  11,  12,  13,  14,  15,  16,  17,  18,  19,  20,  21,  22,  23,  24,
	 25,  26,  27,  28,  29,  30,  31,  32,  33,  34,  35,  36,  37,  38,  39,  40,  41,  42,  43,  44,  45,  46,  47,  48,  49,
	 50,  51,  52,  53,  54,  55,  56,  57,  58,  59,  60,  61,  62,  63,  64,  65,  66,  67,  68,  69,  70,  71,  72,  73,  74,
	 75,  76,  77,  78,  79,  80,  81,  82,  83,  84,  85,  86,  87,  88,  89,  90,  91,  92,  93,  94,  95,  96,  97,  98,  99,
	100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124,
	125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149,
	150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174,
	175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199,
	200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224,
	225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249,
	250, 251, 252, 253, 254, 255, 256,
];
// fallback to number if not in range.
type ParseNumber<T extends string> = T extends keyof NumRange ? NumRange[T] : number;

// TODO: Using this for sanity check, but really should move to formal compilation tests.
type Parts<D extends DataType> = {
	[Key in D]: [TypedArrayConstructor<Key>, TypedArray<Key>, Scalar<Key>];
};
