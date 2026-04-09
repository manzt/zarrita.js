import { assert, describe, expect, test } from "vitest";

import * as zarr from "../src/index.js";
import { json_decode_object } from "../src/util.js";

function json_decode(x: Uint8Array | undefined) {
	assert(x);
	return json_decode_object(x);
}

test("create root group", async () => {
	let attributes = { hello: "world" };
	let grp = await zarr.create(new Map(), { attributes });
	expect(grp.path).toBe("/");
	expect(grp.attrs).toStrictEqual(attributes);
	expect(grp.store.has("/zarr.json")).true;
	expect(json_decode(grp.store.get("/zarr.json"))).toMatchInlineSnapshot(`
		{
		  "attributes": {
		    "hello": "world",
		  },
		  "node_type": "group",
		  "zarr_format": 3,
		}
	`);
});

test("create array", async () => {
	let h = zarr.root();
	let attributes = { question: "life", answer: 42 };
	let a = await zarr.create(h.resolve("/arthur/dent"), {
		shape: [5, 10],
		chunk_shape: [2, 5],
		data_type: "int32",
		attributes,
	});
	expect(a).toBeInstanceOf(zarr.Array);
	expect(a.path).toBe("/arthur/dent");
	expect(a.shape).toStrictEqual([5, 10]);
	expect(a.dtype).toBe("int32");
	expect(a.chunks).toStrictEqual([2, 5]);
	expect(a.attrs).toStrictEqual(attributes);
	expect(a.fillValue).toBeNull();
	expect(
		json_decode(h.store.get("/arthur/dent/zarr.json")),
	).toMatchInlineSnapshot(`
		{
		  "attributes": {
		    "answer": 42,
		    "question": "life",
		  },
		  "chunk_grid": {
		    "configuration": {
		      "chunk_shape": [
		        2,
		        5,
		      ],
		    },
		    "name": "regular",
		  },
		  "chunk_key_encoding": {
		    "configuration": {
		      "separator": "/",
		    },
		    "name": "default",
		  },
		  "codecs": [],
		  "data_type": "int32",
		  "fill_value": null,
		  "node_type": "array",
		  "shape": [
		    5,
		    10,
		  ],
		  "zarr_format": 3,
		}
	`);
});

test("create group from another group", async () => {
	let h = zarr.root();
	let grp = await zarr.create(h.resolve("/tricia/mcmillan"));
	await zarr.create(grp.resolve("relative"));
	await zarr.create(grp.resolve("/absolute"));
	expect(new Set(h.store.keys())).toMatchInlineSnapshot(`
		Set {
		  "/tricia/mcmillan/zarr.json",
		  "/tricia/mcmillan/relative/zarr.json",
		  "/absolute/zarr.json",
		}
	`);
});

describe("create array with IEEE 754 special fill values", () => {
	test.each([
		["NaN", NaN, "NaN"],
		["Infinity", Infinity, "Infinity"],
		["-Infinity", -Infinity, "-Infinity"],
	])("%s", async (_label, fill_value, expected_json) => {
		let h = zarr.root();
		let a = await zarr.create(h.resolve("/test"), {
			shape: [2],
			chunk_shape: [2],
			data_type: "float32",
			fill_value,
			codecs: [],
		});
		let meta = json_decode(h.store.get("/test/zarr.json"));
		expect(meta.fill_value).toBe(expected_json);
		expect(a.fillValue).toBe(fill_value);
	});
});

test("create array with dimension_names", async () => {
	let h = zarr.root();
	let a = await zarr.create(h.resolve("/temp"), {
		shape: [100, 200],
		chunk_shape: [10, 20],
		data_type: "float32",
		dimension_names: ["x", "y"],
	});
	expect(a.dimensionNames).toStrictEqual(["x", "y"]);
	expect(json_decode(h.store.get("/temp/zarr.json"))).toMatchObject({
		dimension_names: ["x", "y"],
	});
});

test("create array with fill_value", async () => {
	let h = zarr.root();
	let a = await zarr.create(h.resolve("/temp"), {
		shape: [10],
		chunk_shape: [5],
		data_type: "float32",
		fill_value: -9999,
	});
	expect(a.fillValue).toBe(-9999);
});

test("create array without dimension_names", async () => {
	let h = zarr.root();
	let a = await zarr.create(h.resolve("/temp"), {
		shape: [10],
		chunk_shape: [5],
		data_type: "int32",
	});
	expect(a.dimensionNames).toBeUndefined();
});

test("get scalar array returns fill value before set", async () => {
	let h = zarr.root();
	let arr = await zarr.create(h.resolve("/scalar"), {
		shape: [],
		chunk_shape: [],
		data_type: "float64",
		fill_value: -9999,
	});
	let value = await zarr.get(arr);
	expect(value).toBe(-9999);
});

test("set and get scalar array (shape=[])", async () => {
	let h = zarr.root();
	let arr = await zarr.create(h.resolve("/scalar"), {
		shape: [],
		chunk_shape: [],
		data_type: "float64",
		fill_value: 0,
	});
	expect(arr.shape).toStrictEqual([]);
	expect(arr.chunks).toStrictEqual([]);

	await zarr.set(arr, null, 42);
	let value = await zarr.get(arr);
	expect(value).toBe(42);
});

test("create nodes via groups", async () => {
	let h = zarr.root();
	let marvin = await zarr.create(h.resolve("/marvin"));
	let paranoid = await zarr.create(marvin.resolve("paranoid"));
	let android = await zarr.create(marvin.resolve("android"), {
		shape: [42, 42],
		data_type: "uint8",
		chunk_shape: [2, 2],
	});
	expect(marvin).toBeInstanceOf(zarr.Group);
	expect(marvin.path).toBe("/marvin");
	expect(paranoid).toBeInstanceOf(zarr.Group);
	expect(paranoid.path).toBe("/marvin/paranoid");
	expect(android).toBeInstanceOf(zarr.Array);
	expect(android.path).toBe("/marvin/android");
});
