import { expectType } from "tintype";
import { assert, describe, expect, test } from "vitest";
import { Array, Group } from "../src/hierarchy.js";
import type { ArrayMetadata } from "../src/metadata.js";

const array_metadata = {
	zarr_format: 3,
	node_type: "array",
	data_type: "int8",
	shape: [10, 10],
	chunk_grid: {
		name: "regular",
		configuration: {
			chunk_shape: [5, 5],
		},
	},
	chunk_key_encoding: {
		name: "default",
		configuration: {
			separator: "/",
		},
	},
	codecs: [],
	fill_value: 0,
	attributes: { answer: 42 },
} satisfies ArrayMetadata;

describe("Array", () => {
	test("constructor", async () => {
		let arr = new Array(new Map(), "/", array_metadata);
		expect({
			shape: arr.shape,
			chunks: arr.chunks,
			dtype: arr.dtype,
			attrs: arr.attrs,
			path: arr.path,
			store: arr.store,
		}).toMatchInlineSnapshot(`
			{
			  "attrs": {
			    "answer": 42,
			  },
			  "chunks": [
			    5,
			    5,
			  ],
			  "dtype": "int8",
			  "path": "/",
			  "shape": [
			    10,
			    10,
			  ],
			  "store": Map {},
			}
		`);
	});

	test("Array.is narrows number", () => {
		let arr = new Array(new Map(), "/", array_metadata as ArrayMetadata);
		expectType(arr.dtype).toMatchInlineSnapshot(`DataType`);
		assert(arr.is("number"));
		expectType(arr.dtype).toMatchInlineSnapshot(`NumberDataType`);
	});

	test("Array.is narrows bigint", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "uint64",
		} as ArrayMetadata);
		assert(arr.is("bigint"));
		expectType(arr.dtype).toMatchInlineSnapshot(`BigintDataType`);
	});

	test("Array.is narrows boolean", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "bool",
			fill_value: false,
		} as ArrayMetadata);
		assert(arr.is("boolean"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"bool"`);
	});

	test("Array.is narrows string", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "string",
			fill_value: "",
		} as ArrayMetadata);
		assert(arr.is("string"));
		expectType(arr.dtype).toMatchInlineSnapshot(`StringDataType`);
	});

	test("Array.is narrows object", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "v2:object",
			fill_value: null,
		} as ArrayMetadata);
		assert(arr.is("object"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"v2:object"`);
	});

	test("Array.is narrows exact int8", () => {
		let arr = new Array(new Map(), "/", array_metadata as ArrayMetadata);
		assert(arr.is("int8"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"int8"`);
	});

	test("Array.is narrows exact int16", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "int16",
		} as ArrayMetadata);
		assert(arr.is("int16"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"int16"`);
	});

	test("Array.is narrows exact int32", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "int32",
		} as ArrayMetadata);
		assert(arr.is("int32"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"int32"`);
	});

	test("Array.is narrows exact int64", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "int64",
		} as ArrayMetadata);
		assert(arr.is("int64"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"int64"`);
	});

	test("Array.is narrows exact uint8", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "uint8",
		} as ArrayMetadata);
		assert(arr.is("uint8"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"uint8"`);
	});

	test("Array.is narrows exact uint16", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "uint16",
		} as ArrayMetadata);
		assert(arr.is("uint16"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"uint16"`);
	});

	test("Array.is narrows exact uint32", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "uint32",
		} as ArrayMetadata);
		assert(arr.is("uint32"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"uint32"`);
	});

	test("Array.is narrows exact uint64", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "uint64",
		} as ArrayMetadata);
		assert(arr.is("uint64"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"uint64"`);
	});

	test("Array.is narrows exact float32", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "float32",
		} as ArrayMetadata);
		assert(arr.is("float32"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"float32"`);
	});

	test("Array.is narrows exact float64", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "float64",
		} as ArrayMetadata);
		assert(arr.is("float64"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"float64"`);
	});

	test("Array.is narrows exact bool", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "bool",
			fill_value: false,
		} as ArrayMetadata);
		assert(arr.is("bool"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"bool"`);
	});

	test("Array.is narrows from NumberDataType to exact dtype", () => {
		let arr = new Array(new Map(), "/", array_metadata as ArrayMetadata);
		assert(arr.is("number"));
		expectType(arr.dtype).toMatchInlineSnapshot(`NumberDataType`);
		assert(arr.is("int8"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"int8"`);
	});

	test("Array.is narrows from BigintDataType to exact dtype", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "uint64",
		} as ArrayMetadata);
		assert(arr.is("bigint"));
		expectType(arr.dtype).toMatchInlineSnapshot(`BigintDataType`);
		assert(arr.is("uint64"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"uint64"`);
	});

	test("getChunk returns fill_value for missing uint64 chunk", async () => {
		// Cast needed: fill_value is intentionally a number (not bigint) to
		// simulate JSON-parsed metadata, which is how the bug manifests.
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "uint64",
			codecs: [{ name: "bytes", configuration: { endian: "little" } }],
		} as ArrayMetadata);
		let chunk = await arr.getChunk([0, 0]);
		expect(chunk.data).toBeInstanceOf(BigUint64Array);
		assert(chunk.data instanceof BigUint64Array);
		expect(chunk.data[0]).toBe(0n);
	});

	test("getChunk returns fill_value for missing int64 chunk", async () => {
		// Cast needed: fill_value is intentionally a number (not bigint) to
		// simulate JSON-parsed metadata, which is how the bug manifests.
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "int64",
			codecs: [{ name: "bytes", configuration: { endian: "little" } }],
		} as ArrayMetadata);
		let chunk = await arr.getChunk([0, 0]);
		expect(chunk.data).toBeInstanceOf(BigInt64Array);
		assert(chunk.data instanceof BigInt64Array);
		expect(chunk.data[0]).toBe(0n);
	});
});

describe("Group", () => {
	test("constructor", async () => {
		let grp = new Group(new Map(), "/", {
			zarr_format: 3,
			node_type: "group",
			attributes: { answer: 42 },
		});
		expect({
			attrs: grp.attrs,
			path: grp.path,
			store: grp.store,
		}).toMatchInlineSnapshot(`
			{
			  "attrs": {
			    "answer": 42,
			  },
			  "path": "/",
			  "store": Map {},
			}
		`);
	});
});
