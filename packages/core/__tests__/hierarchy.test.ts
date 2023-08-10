import { describe, expect, expectTypeOf, test } from "vitest";
import { Array, Group } from "../src/hierarchy.js";
import type {
	ArrayMetadata,
	BigintDataType,
	Bool,
	DataType,
	Int8,
	NumberDataType,
	Raw,
} from "../src/metadata.js";

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
			chunk_shape: arr.chunk_shape,
			dtype: arr.dtype,
			fill_value: arr.fill_value,
			attrs: await arr.attrs(),
			path: arr.path,
			codec_pipeline: arr.codec_pipeline,
			store: arr.store,
		}).toMatchInlineSnapshot(`
			{
			  "attrs": {
			    "answer": 42,
			  },
			  "chunk_shape": [
			    5,
			    5,
			  ],
			  "codec_pipeline": {
			    "decode": [Function],
			    "encode": [Function],
			  },
			  "dtype": "int8",
			  "fill_value": 0,
			  "path": "/",
			  "shape": [
			    10,
			    10,
			  ],
			  "store": Map {},
			}
		`);
	});

	test("Array.is", () => {
		let arr = new Array(new Map(), "/", array_metadata as any);
		expectTypeOf(arr.dtype).toMatchTypeOf<DataType>();
		if (arr.is("bigint")) {
			expectTypeOf(arr.dtype).toMatchTypeOf<BigintDataType>();
		}
		if (arr.is("number")) {
			expectTypeOf(arr.dtype).toMatchTypeOf<NumberDataType>();
		}
		if (arr.is("bool")) {
			expectTypeOf(arr.dtype).toMatchTypeOf<Bool>();
		}
		if (arr.is("raw")) {
			expectTypeOf(arr.dtype).toMatchTypeOf<Raw>();
		}
		if (arr.is("int8")) {
			expectTypeOf(arr.dtype).toMatchTypeOf<Int8>();
		}
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
			attrs: await grp.attrs(),
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
