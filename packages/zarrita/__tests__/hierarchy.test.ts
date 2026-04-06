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

	test("Array.is narrows exact dtype", () => {
		let arr = new Array(new Map(), "/", array_metadata as ArrayMetadata);
		assert(arr.is("int8"));
		expectType(arr.dtype).toMatchInlineSnapshot(`"int8"`);
	});

	test("Array.is narrows bigint", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "uint64",
		} as ArrayMetadata);
		assert(arr.is("bigint"));
		expectType(arr.dtype).toMatchInlineSnapshot(`BigintDataType`);
	});

	test("Array.is narrows bool", () => {
		let arr = new Array(new Map(), "/", {
			...array_metadata,
			data_type: "bool",
			fill_value: false,
		} as ArrayMetadata);
		assert(arr.is("bool"));
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
