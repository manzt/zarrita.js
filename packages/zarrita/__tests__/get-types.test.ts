import { expectType } from "tintype";
import { describe, test } from "vitest";
import * as zarr from "../src/index.js";

function mockArray<D extends zarr.DataType>() {
	return new zarr.Array(new Map(), "/", {
		zarr_format: 3,
		node_type: "array",
		data_type: "int8",
		shape: [2, 2],
		chunk_grid: { name: "regular", configuration: { chunk_shape: [2, 2] } },
		chunk_key_encoding: { name: "default", configuration: { separator: "/" } },
		codecs: [],
		fill_value: 0,
		attributes: {},
	} as unknown as zarr.ArrayMetadata<D>);
}

// ─── Chunk<D> for every concrete dtype ──────────────────────────────

describe("Chunk type per dtype", () => {
	test("int8", async () => {
		let chunk = await zarr.get(mockArray<zarr.Int8>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"int8">`);
		expectType(chunk.data).toMatchInlineSnapshot(`Int8Array<ArrayBufferLike>`);
	});

	test("int16", async () => {
		let chunk = await zarr.get(mockArray<zarr.Int16>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"int16">`);
		expectType(chunk.data).toMatchInlineSnapshot(`Int16Array<ArrayBufferLike>`);
	});

	test("int32", async () => {
		let chunk = await zarr.get(mockArray<zarr.Int32>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"int32">`);
		expectType(chunk.data).toMatchInlineSnapshot(`Int32Array<ArrayBufferLike>`);
	});

	test("int64", async () => {
		let chunk = await zarr.get(mockArray<zarr.Int64>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"int64">`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`BigInt64Array<ArrayBufferLike>`,
		);
	});

	test("uint8", async () => {
		let chunk = await zarr.get(mockArray<zarr.Uint8>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"uint8">`);
		expectType(chunk.data).toMatchInlineSnapshot(`Uint8Array<ArrayBufferLike>`);
	});

	test("uint16", async () => {
		let chunk = await zarr.get(mockArray<zarr.Uint16>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"uint16">`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`Uint16Array<ArrayBufferLike>`,
		);
	});

	test("uint32", async () => {
		let chunk = await zarr.get(mockArray<zarr.Uint32>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"uint32">`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`Uint32Array<ArrayBufferLike>`,
		);
	});

	test("uint64", async () => {
		let chunk = await zarr.get(mockArray<zarr.Uint64>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"uint64">`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`BigUint64Array<ArrayBufferLike>`,
		);
	});

	test("float32", async () => {
		let chunk = await zarr.get(mockArray<zarr.Float32>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"float32">`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`Float32Array<ArrayBufferLike>`,
		);
	});

	test("float64", async () => {
		let chunk = await zarr.get(mockArray<zarr.Float64>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"float64">`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`Float64Array<ArrayBufferLike>`,
		);
	});

	test("bool", async () => {
		let chunk = await zarr.get(mockArray<zarr.Bool>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"bool">`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`zarr.BoolArray<ArrayBufferLike>`,
		);
	});

	test("string", async () => {
		let chunk = await zarr.get(mockArray<zarr.String>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"string">`);
		expectType(chunk.data).toMatchInlineSnapshot(`string[]`);
	});

	test("v2:object", async () => {
		let chunk = await zarr.get(mockArray<zarr.ObjectType>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<"v2:object">`);
		expectType(chunk.data).toMatchInlineSnapshot(`unknown[]`);
	});
});

// ─── Chunk<D> for union dtypes ──────────────────────────────────────

describe("Chunk type per union dtype", () => {
	test("NumberDataType", async () => {
		let chunk = await zarr.get(mockArray<zarr.NumberDataType>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<zarr.NumberDataType>`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`
			| Int8Array<ArrayBufferLike>
				| Int16Array<ArrayBufferLike>
				| Int32Array<ArrayBufferLike>
				| Uint8Array<ArrayBufferLike>
				| Uint16Array<ArrayBufferLike>
				| Uint32Array<ArrayBufferLike>
				| Float16Array<ArrayBufferLike>
				| Float32Array<ArrayBufferLike>
				| Float64Array<ArrayBufferLike>
		`,
		);
	});

	test("BigintDataType", async () => {
		let chunk = await zarr.get(mockArray<zarr.BigintDataType>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<zarr.BigintDataType>`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`
			| BigInt64Array<ArrayBufferLike>
				| BigUint64Array<ArrayBufferLike>
		`,
		);
	});

	test("StringDataType", async () => {
		let chunk = await zarr.get(mockArray<zarr.StringDataType>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<zarr.StringDataType>`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`
			| string[]
				| zarr.UnicodeStringArray<ArrayBufferLike>
				| zarr.ByteStringArray<ArrayBufferLike>
		`,
		);
	});

	test("DataType", async () => {
		let chunk = await zarr.get(mockArray<zarr.DataType>());
		expectType(chunk).toMatchInlineSnapshot(`zarr.Chunk<zarr.DataType>`);
		expectType(chunk.data).toMatchInlineSnapshot(
			`
			| string[]
				| Int8Array<ArrayBufferLike>
				| Int16Array<ArrayBufferLike>
				| Int32Array<ArrayBufferLike>
				| BigInt64Array<ArrayBufferLike>
				| Uint8Array<ArrayBufferLike>
				| Uint16Array<ArrayBufferLike>
				| Uint32Array<ArrayBufferLike>
				| BigUint64Array<ArrayBufferLike>
				| Float16Array<ArrayBufferLike>
				| Float32Array<ArrayBufferLike>
				| Float64Array<ArrayBufferLike>
				| zarr.BoolArray<ArrayBufferLike>
				| zarr.UnicodeStringArray<ArrayBufferLike>
				| zarr.ByteStringArray<ArrayBufferLike>
				| unknown[]
		`,
		);
	});
});

// ─── Scalar<D> for union dtypes ─────────────────────────────────────

describe("Scalar type per union dtype (point selection)", () => {
	test("NumberDataType", async () => {
		let scalar = await zarr.get(mockArray<zarr.NumberDataType>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`number`);
	});

	test("BigintDataType", async () => {
		let scalar = await zarr.get(mockArray<zarr.BigintDataType>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`bigint`);
	});

	test("StringDataType", async () => {
		let scalar = await zarr.get(mockArray<zarr.StringDataType>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`string`);
	});

	test("DataType", async () => {
		let scalar = await zarr.get(mockArray<zarr.DataType>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`unknown`);
	});
});

// ─── Scalar<D> via point selection ──────────────────────────────────

describe("Scalar type per dtype (point selection)", () => {
	test("int8", async () => {
		let scalar = await zarr.get(mockArray<zarr.Int8>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`number`);
	});

	test("int16", async () => {
		let scalar = await zarr.get(mockArray<zarr.Int16>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`number`);
	});

	test("int32", async () => {
		let scalar = await zarr.get(mockArray<zarr.Int32>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`number`);
	});

	test("int64", async () => {
		let scalar = await zarr.get(mockArray<zarr.Int64>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`bigint`);
	});

	test("uint8", async () => {
		let scalar = await zarr.get(mockArray<zarr.Uint8>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`number`);
	});

	test("uint16", async () => {
		let scalar = await zarr.get(mockArray<zarr.Uint16>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`number`);
	});

	test("uint32", async () => {
		let scalar = await zarr.get(mockArray<zarr.Uint32>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`number`);
	});

	test("uint64", async () => {
		let scalar = await zarr.get(mockArray<zarr.Uint64>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`bigint`);
	});

	test("float32", async () => {
		let scalar = await zarr.get(mockArray<zarr.Float32>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`number`);
	});

	test("float64", async () => {
		let scalar = await zarr.get(mockArray<zarr.Float64>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`number`);
	});

	test("bool", async () => {
		let scalar = await zarr.get(mockArray<zarr.Bool>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`boolean`);
	});

	test("string", async () => {
		let scalar = await zarr.get(mockArray<zarr.String>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`string`);
	});

	test("v2:object", async () => {
		let scalar = await zarr.get(mockArray<zarr.ObjectType>(), [0, 0]);
		expectType(scalar).toMatchInlineSnapshot(`unknown`);
	});
});

// ─── Selection patterns: Chunk vs Scalar inference ──────────────────

describe("Selection-based return type", () => {
	test("no selection returns Chunk", async () => {
		let result = await zarr.get(mockArray<zarr.Int32>());
		expectType(result).toMatchInlineSnapshot(`zarr.Chunk<"int32">`);
	});

	test("null selection returns Chunk", async () => {
		let result = await zarr.get(mockArray<zarr.Int32>(), null);
		expectType(result).toMatchInlineSnapshot(`zarr.Chunk<"int32">`);
	});

	test("slice selection returns Chunk", async () => {
		let result = await zarr.get(mockArray<zarr.Int32>(), [
			zarr.slice(null),
			zarr.slice(null),
		]);
		expectType(result).toMatchInlineSnapshot(`zarr.Chunk<"int32">`);
	});

	test("point selection returns Scalar", async () => {
		let result = await zarr.get(mockArray<zarr.Int32>(), [0, 0]);
		expectType(result).toMatchInlineSnapshot(`number`);
	});
});
