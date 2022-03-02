import type {
	BigintDataType,
	DataType,
	NumericDataType,
	StringDataType,
} from "../dtypes";

type DataTypeWithoutEndianness = DataType extends `${infer _}${infer Rest}` ? Rest
	: never;

export type DataTypeQuery =
	| DataType
	| DataTypeWithoutEndianness
	| "number"
	| "bigint"
	| "string";

function is<Query extends DataTypeQuery>(
	dtype: DataType,
	query: Query,
): dtype is (
	Query extends "number" ? NumericDataType
		: Query extends "bigint" ? BigintDataType
		: Query extends "string" ? StringDataType
		: Extract<Query | `${"<" | ">" | "|"}${Query}`, DataType>
) {
	let nbytes = Number(dtype.slice(2));
	if (query === "number") {
		return nbytes === 1 || nbytes === 2 || nbytes === 4;
	}
	if (query === "bigint") {
		return nbytes === 8;
	}
	if (query === "string") {
		return dtype[1] === "S" || dtype[1] === "U";
	}
	// exact datatype
	if (dtype.length >= 3) {
		return query === dtype;
	}
	return dtype === `|${query}` || dtype === `>${query}` || `<${dtype}` === dtype;
}

declare const d: DataType;

if (is(d, "u8")) {
	d;
}
