import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import * as zarr from "../src/index.js";
import { sel, slice } from "../src/indexing/util.js";
import type { ArrayMetadata, DataType } from "../src/metadata.js";
import {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "../src/typedarray.js";
import {
	byteswapInplace,
	ensureCorrectScalar,
	getCtr,
	getStrides,
	isDtype,
	v2ToV3ArrayMetadata,
} from "../src/util.js";

describe("getCtr", () => {
	describe("without Float16Array", () => {
		beforeAll(() => {
			vi.stubGlobal("Float16Array", undefined);
		});
		afterAll(() => {
			vi.unstubAllGlobals();
		});
		test.each<[DataType, unknown]>([
			["int8", Int8Array],
			["int16", Int16Array],
			["int32", Int32Array],
			["int64", BigInt64Array],
			["uint8", Uint8Array],
			["uint16", Uint16Array],
			["uint32", Uint32Array],
			["uint64", BigUint64Array],
			["float32", Float32Array],
			["float64", Float64Array],
			["bool", BoolArray],
			["v2:U6", UnicodeStringArray],
			["v2:S6", ByteStringArray],
			["string", Array],
		])("%s -> %o", (dtype, ctr) => {
			const T = getCtr(dtype);
			expect(new T(1)).toBeInstanceOf(ctr);
		});

		test.each(["float16"])("%s -> throws", (dtype) => {
			expect(() => getCtr(dtype as DataType)).toThrowError();
		});
	});

	describe("with Float16Array", () => {
		class Float16ArrayStub {}
		beforeAll(() => {
			vi.stubGlobal("Float16Array", Float16ArrayStub);
		});
		afterAll(() => {
			vi.unstubAllGlobals();
		});
		test.each<[DataType, unknown]>([
			["int8", Int8Array],
			["int16", Int16Array],
			["int32", Int32Array],
			["int64", BigInt64Array],
			["uint8", Uint8Array],
			["uint16", Uint16Array],
			["uint32", Uint32Array],
			["uint64", BigUint64Array],
			["float16", Float16ArrayStub],
			["float32", Float32Array],
			["float64", Float64Array],
			["bool", BoolArray],
			["v2:U6", UnicodeStringArray],
			["v2:S6", ByteStringArray],
			["string", Array],
		])("%s -> %o", (dtype, ctr) => {
			const T = getCtr(dtype);
			expect(new T(1)).toBeInstanceOf(ctr);
		});
	});
});

describe("byteswapInplace", () => {
	test.each([
		new Uint32Array([1, 2, 3, 4, 5]),
		new Float64Array([20, 3333, 444.4, 222, 3123]),
		new Float32Array([1, 2, 3, 42, 5]),
		new Uint8Array([1, 2, 3, 4]),
		new Int8Array([-3, 2, 3, 10]),
	])("%o", (arr) => {
		// make a copy and then byteswap original twice
		const expected = arr.slice();
		byteswapInplace(new Uint8Array(arr.buffer), arr.BYTES_PER_ELEMENT);
		byteswapInplace(new Uint8Array(arr.buffer), arr.BYTES_PER_ELEMENT);
		expect(arr).toStrictEqual(expected);
	});
});

describe("getStrides", () => {
	test.each<[number[], "C" | "F", number[]]>([
		[[3], "C", [1]],
		[[3], "F", [1]],
		[[3, 4], "C", [4, 1]],
		[[3, 4], "F", [1, 3]],
		[[3, 4, 10], "C", [40, 10, 1]],
		[[3, 4, 10], "F", [1, 3, 12]],
		[[3, 4, 10, 2], "C", [80, 20, 2, 1]],
		[[3, 4, 10, 2], "F", [1, 3, 12, 120]],
	])("getStrides(%o, %s) -> %o", (shape, order, expected) => {
		expect(getStrides(shape, order)).toStrictEqual(expected);
	});
});

describe("isDtype", () => {
	test.each<[DataType, boolean]>([
		["int8", true],
		["int16", true],
		["int32", true],
		["uint8", true],
		["uint16", true],
		["uint32", true],
		["float16", true],
		["float32", true],
		["float64", true],
		["bool", false],
		["int64", false],
		["uint64", false],
		["v2:U6", false],
		["v2:S6", false],
		["v2:object", false],
		["string", false],
	])("isDtype(%s, 'number') -> %s", (dtype, expected) => {
		expect(isDtype(dtype, "number")).toBe(expected);
	});

	test.each<[DataType, boolean]>([
		["int8", false],
		["int16", false],
		["int32", false],
		["uint8", false],
		["uint16", false],
		["uint32", false],
		["float16", false],
		["float32", false],
		["float64", false],
		["bool", true],
		["int64", false],
		["uint64", false],
		["v2:U6", false],
		["v2:S6", false],
		["v2:object", false],
		["string", false],
	])("isDtype(%s, 'boolean') -> %s", (dtype, expected) => {
		expect(isDtype(dtype, "boolean")).toBe(expected);
	});

	test.each<[DataType, boolean]>([
		["int8", false],
		["int16", false],
		["int32", false],
		["uint8", false],
		["uint16", false],
		["uint32", false],
		["float16", false],
		["float32", false],
		["float64", false],
		["bool", false],
		["int64", true],
		["uint64", true],
		["v2:U6", false],
		["v2:S6", false],
		["v2:object", false],
		["string", false],
	])("isDtype(%s, 'bigint') -> %s", (dtype, expected) => {
		expect(isDtype(dtype, "bigint")).toBe(expected);
	});

	test.each<[DataType, boolean]>([
		["int8", false],
		["int16", false],
		["int32", false],
		["uint8", false],
		["uint16", false],
		["uint32", false],
		["float16", false],
		["float32", false],
		["float64", false],
		["bool", false],
		["int64", false],
		["uint64", false],
		["v2:U6", true],
		["v2:S6", true],
		["v2:object", false],
		["string", true],
	])("isDtype(%s, 'string') -> %s", (dtype, expected) => {
		expect(isDtype(dtype, "string")).toBe(expected);
	});

	test.each<DataType>([
		"int8",
		"int16",
		"int32",
		"uint8",
		"uint16",
		"uint32",
		"float16",
		"float32",
		"float64",
		"bool",
		"int64",
		"uint64",
		"v2:U6",
		"v2:S6",
		"v2:object",
		"string",
	])("isDtype(%s, %s) -> true", (dtype) => {
		expect(isDtype(dtype, dtype)).toBe(true);
	});
});

describe("ensureCorrectScalar", () => {
	function make_metadata(
		data_type: DataType,
		fill_value: unknown,
	): ArrayMetadata {
		return {
			zarr_format: 3,
			node_type: "array",
			shape: [1],
			data_type,
			chunk_grid: { name: "regular", configuration: { chunk_shape: [1] } },
			chunk_key_encoding: { name: "default" },
			codecs: [],
			fill_value,
			attributes: {},
		} as ArrayMetadata;
	}

	test.each([
		["NaN", NaN],
		["Infinity", Infinity],
		["-Infinity", -Infinity],
	])("float32 fill_value %s -> %s", (str, expected) => {
		let result = ensureCorrectScalar(make_metadata("float32", str));
		if (Number.isNaN(expected)) {
			expect(result).toBeNaN();
		} else {
			expect(result).toBe(expected);
		}
	});

	test.each([
		"float16",
		"float32",
		"float64",
	] as const)("%s preserves numeric fill_value", (dtype) => {
		expect(ensureCorrectScalar(make_metadata(dtype, 1.5))).toBe(1.5);
	});

	test("string dtype fill_value 'NaN' stays as string", () => {
		expect(ensureCorrectScalar(make_metadata("string", "NaN"))).toBe("NaN");
	});

	test("int64 fill_value converts to BigInt", () => {
		expect(ensureCorrectScalar(make_metadata("int64", 42))).toBe(42n);
	});
});

describe("sel", () => {
	async function make_array(dimensionNames?: string[]) {
		let h = zarr.root();
		return zarr.create(h.resolve("/test"), {
			shape: [100, 200, 300],
			chunkShape: [10, 20, 30],
			dataType: "float32",
			dimensionNames,
		});
	}

	test("maps named dimensions to positional selection", async () => {
		let arr = await make_array(["time", "lat", "lon"]);
		expect(sel(arr, { lat: slice(10, 20), time: 0 })).toStrictEqual([
			0,
			{ start: 10, stop: 20, step: null },
			null,
		]);
	});

	test("unspecified dimensions default to null", async () => {
		let arr = await make_array(["time", "lat", "lon"]);
		expect(sel(arr, { lon: 5 })).toStrictEqual([null, null, 5]);
	});

	test("throws for unknown dimension name", async () => {
		let arr = await make_array(["time", "lat", "lon"]);
		expect(() => sel(arr, { bad: 0 })).toThrowError(
			/Unknown dimension name: "bad"/,
		);
	});

	test("throws when array has no dimension_names", async () => {
		let arr = await make_array();
		expect(() => sel(arr, { time: 0 })).toThrowError(
			/does not have dimension_names/,
		);
	});
});

describe("v2ToV3ArrayMetadata", () => {
	let v2meta = {
		zarr_format: 2 as const,
		shape: [100, 200],
		chunks: [10, 20],
		dtype: "<f4",
		compressor: null,
		fill_value: 0,
		order: "C" as const,
		filters: null,
	};

	test("basic conversion", () => {
		let result = v2ToV3ArrayMetadata(v2meta);
		expect(result).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        10,
			        20,
			      ],
			    },
			    "name": "regular",
			  },
			  "chunk_key_encoding": {
			    "configuration": {
			      "separator": ".",
			    },
			    "name": "v2",
			  },
			  "codecs": [],
			  "data_type": "float32",
			  "dimension_names": undefined,
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    100,
			    200,
			  ],
			  "zarr_format": 3,
			}
		`);
	});

	test("maps _ARRAY_DIMENSIONS to dimension_names", () => {
		let result = v2ToV3ArrayMetadata(v2meta, {
			_ARRAY_DIMENSIONS: ["x", "y"],
		});
		expect(result).toMatchInlineSnapshot(`
			{
			  "attributes": {
			    "_ARRAY_DIMENSIONS": [
			      "x",
			      "y",
			    ],
			  },
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        10,
			        20,
			      ],
			    },
			    "name": "regular",
			  },
			  "chunk_key_encoding": {
			    "configuration": {
			      "separator": ".",
			    },
			    "name": "v2",
			  },
			  "codecs": [],
			  "data_type": "float32",
			  "dimension_names": [
			    "x",
			    "y",
			  ],
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    100,
			    200,
			  ],
			  "zarr_format": 3,
			}
		`);
	});

	test("Fortran order adds transpose codec", () => {
		let result = v2ToV3ArrayMetadata({ ...v2meta, order: "F" });
		expect(result).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        10,
			        20,
			      ],
			    },
			    "name": "regular",
			  },
			  "chunk_key_encoding": {
			    "configuration": {
			      "separator": ".",
			    },
			    "name": "v2",
			  },
			  "codecs": [
			    {
			      "configuration": {
			        "order": "F",
			      },
			      "name": "transpose",
			    },
			  ],
			  "data_type": "float32",
			  "dimension_names": undefined,
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    100,
			    200,
			  ],
			  "zarr_format": 3,
			}
		`);
	});

	test("big-endian dtype adds bytes codec", () => {
		let result = v2ToV3ArrayMetadata({ ...v2meta, dtype: ">f4" });
		expect(result).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        10,
			        20,
			      ],
			    },
			    "name": "regular",
			  },
			  "chunk_key_encoding": {
			    "configuration": {
			      "separator": ".",
			    },
			    "name": "v2",
			  },
			  "codecs": [
			    {
			      "configuration": {
			        "endian": "big",
			      },
			      "name": "bytes",
			    },
			  ],
			  "data_type": "float32",
			  "dimension_names": undefined,
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    100,
			    200,
			  ],
			  "zarr_format": 3,
			}
		`);
	});

	test("compressor is converted to codec", () => {
		let result = v2ToV3ArrayMetadata({
			...v2meta,
			compressor: { id: "zlib", level: 5 },
		});
		expect(result).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        10,
			        20,
			      ],
			    },
			    "name": "regular",
			  },
			  "chunk_key_encoding": {
			    "configuration": {
			      "separator": ".",
			    },
			    "name": "v2",
			  },
			  "codecs": [
			    {
			      "configuration": {
			        "level": 5,
			      },
			      "name": "numcodecs.zlib",
			    },
			  ],
			  "data_type": "float32",
			  "dimension_names": undefined,
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    100,
			    200,
			  ],
			  "zarr_format": 3,
			}
		`);
	});

	test("filters are converted to codecs", () => {
		let result = v2ToV3ArrayMetadata({
			...v2meta,
			filters: [{ id: "delta", dtype: "<f4" }],
		});
		expect(result).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        10,
			        20,
			      ],
			    },
			    "name": "regular",
			  },
			  "chunk_key_encoding": {
			    "configuration": {
			      "separator": ".",
			    },
			    "name": "v2",
			  },
			  "codecs": [
			    {
			      "configuration": {
			        "dtype": "<f4",
			      },
			      "name": "numcodecs.delta",
			    },
			  ],
			  "data_type": "float32",
			  "dimension_names": undefined,
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    100,
			    200,
			  ],
			  "zarr_format": 3,
			}
		`);
	});

	test("dimension_separator is preserved", () => {
		let result = v2ToV3ArrayMetadata({
			...v2meta,
			dimension_separator: "/",
		});
		expect(result).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        10,
			        20,
			      ],
			    },
			    "name": "regular",
			  },
			  "chunk_key_encoding": {
			    "configuration": {
			      "separator": "/",
			    },
			    "name": "v2",
			  },
			  "codecs": [],
			  "data_type": "float32",
			  "dimension_names": undefined,
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    100,
			    200,
			  ],
			  "zarr_format": 3,
			}
		`);
	});

	test("codec order: transpose, bytes, filters, compressor", () => {
		let result = v2ToV3ArrayMetadata({
			...v2meta,
			dtype: ">f4",
			order: "F",
			filters: [{ id: "delta", dtype: ">f4" }],
			compressor: { id: "zlib", level: 1 },
		});
		expect(result).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        10,
			        20,
			      ],
			    },
			    "name": "regular",
			  },
			  "chunk_key_encoding": {
			    "configuration": {
			      "separator": ".",
			    },
			    "name": "v2",
			  },
			  "codecs": [
			    {
			      "configuration": {
			        "order": "F",
			      },
			      "name": "transpose",
			    },
			    {
			      "configuration": {
			        "endian": "big",
			      },
			      "name": "bytes",
			    },
			    {
			      "configuration": {
			        "dtype": ">f4",
			      },
			      "name": "numcodecs.delta",
			    },
			    {
			      "configuration": {
			        "level": 1,
			      },
			      "name": "numcodecs.zlib",
			    },
			  ],
			  "data_type": "float32",
			  "dimension_names": undefined,
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    100,
			    200,
			  ],
			  "zarr_format": 3,
			}
		`);
	});
});
