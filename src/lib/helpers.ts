// @ts-nocheck
import type { DataType, NumericDataType, Store, WithoutEndianness } from "../types";
import type { ZarrArray } from "./hierarchy";

// TODO: don't currently work...

type Expand<Str extends DataType | WithoutEndianness> =
	| Str
	| `${">" | "<" | "|"}${Str}`;

export function is<
	Str extends DataType | WithoutEndianness,
	S extends Store,
>(
	arr: ZarrArray<any, S>,
	str: Str,
): arr is ZarrArray<Extract<Expand<Str> & DataType, any>, S> {
	// Caution! this is very sensitive to the data-type strings!
	return arr.dtype === (str as DataType) || arr.dtype.slice(1) === str;
}

export function is_numeric<
	S extends Store,
>(arr: ZarrArray<any, S>): arr is ZarrArray<NumericDataType, S> {
	return (arr.dtype !== "|b1" && !arr.dtype.includes("U") &&
		!arr.dtype.includes("S"));
}
