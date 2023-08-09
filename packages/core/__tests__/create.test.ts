import { expect, test } from "vitest";
import ndarray from "ndarray";

import MemStore from "@zarrita/storage/mem";

import * as zarr from "../src/index.js";
import { json_decode_object, range } from "../src/util.js";
let { get, set } = zarr.ops;

test("create root group", async () => {
	let h = zarr.root(new MemStore());
	let attributes = { hello: "world" };
	let grp = await zarr.create(h, { attributes });
	expect(grp.path).toBe("/");
	expect(await grp.attrs()).toStrictEqual(attributes);
	expect(h.store.has("/zarr.json")).true;
	expect(json_decode_object(h.store.get("/zarr.json")!)).toMatchInlineSnapshot(`
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
	let h = zarr.root(new MemStore());
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
	expect(a.chunk_shape).toStrictEqual([2, 5]);
	expect(await a.attrs()).toStrictEqual(attributes);
	expect(json_decode_object(h.store.get("/arthur/dent/zarr.json")!))
		.toMatchInlineSnapshot(`
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
	let h = zarr.root(new Map());
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

test("create nodes via groups", async () => {
	let h = zarr.root(new MemStore());
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

test("Read and write array data - builtin", async () => {
	let h = zarr.root(new MemStore());
	let a = await zarr.create(h.resolve("/arthur/dent"), {
		shape: [5, 10],
		data_type: "int32",
		chunk_shape: [2, 5],
	});

	let res = await get(a, [null, null]);
	expect(res.shape).toStrictEqual([5, 10]);
	expect(res.data).toStrictEqual(new Int32Array(50));

	res = await get(a);
	expect(res.shape).toStrictEqual([5, 10]);
	expect(res.data).toStrictEqual(new Int32Array(50));

	await set(a, [0, null], 42);
	expect((await get(a, null)).data).toStrictEqual(
		new Int32Array(50).fill(42, 0, 10),
	);

	const expected = new Int32Array(50).fill(42, 0, 10);
	[10, 20, 30, 40].forEach((i) => (expected[i] = 42));
	await set(a, [null, 0], 42);
	expect((await get(a, null)).data).toStrictEqual(expected);

	await set(a, null, 42);
	expected.fill(42);
	expect((await get(a, null)).data).toStrictEqual(expected);

	let arr = ndarray(new Int32Array([...Array(10).keys()]), [10]);
	expected.set(arr.data);
	await set(a, [0, null], arr);
	expect((await get(a, null)).data).toStrictEqual(expected);

	arr = ndarray(new Int32Array(range(50)), [5, 10]);
	await set(a, null, arr);
	expect((await get(a, null)).data).toStrictEqual(arr.data);

	// Read array slices
	res = await get(a, [null, 0]);
	expect(res.shape).toStrictEqual([5]);
	expect(res.data).toStrictEqual(new Int32Array([0, 10, 20, 30, 40]));

	res = await get(a, [null, 1]);
	expect(res.shape).toStrictEqual([5]);
	expect(res.data).toStrictEqual(new Int32Array([1, 11, 21, 31, 41]));

	res = await get(a, [0, null]);
	expect(res.shape).toStrictEqual([10]);
	expect(res.data).toStrictEqual(
		new Int32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
	);

	res = await get(a, [1, null]);
	expect(res.shape).toStrictEqual([10]);
	expect(res.data).toStrictEqual(
		new Int32Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
	);

	res = await get(a, [null, zarr.slice(0, 7)]);
	expect(res.shape).toStrictEqual([5, 7]);
	// deno-fmt-ignore
	expect(res.data).toStrictEqual(new Int32Array([ 
		 0,  1,  2,  3,  4,
		 5,  6, 10, 11, 12,
		13, 14, 15, 16, 20,
		21, 22, 23, 24, 25,
		26, 30, 31, 32, 33,
		34, 35, 36, 40, 41,
		42, 43, 44, 45, 46,
	]));

	res = await get(a, [zarr.slice(0, 3), null]);
	expect(res.shape).toStrictEqual([3, 10]);
	// deno-fmt-ignore
	expect(res.data).toStrictEqual(new Int32Array([
		 0,  1,  2,  3,  4,  5,  6,  7,  8,  9,
		10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
		20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
	]));
	res = await get(a, [zarr.slice(0, 3), zarr.slice(0, 7)]);
	expect(res.shape).toStrictEqual([3, 7]);
	// deno-fmt-ignore
	expect(res.data).toStrictEqual(new Int32Array([
		 0,  1,  2,  3,  4,  5,  6,
		10, 11, 12, 13, 14, 15, 16,
		20, 21, 22, 23, 24, 25, 26,
	]));

	res = await get(a, [zarr.slice(1, 4), zarr.slice(2, 7)]);
	expect(res.shape).toStrictEqual([3, 5]);
	// deno-fmt-ignore
	expect(res.data).toStrictEqual(new Int32Array([
		12, 13, 14, 15, 16,
		22, 23, 24, 25, 26,
		32, 33, 34, 35, 36,
	]));

	let b = await zarr.create(h.resolve("/deep/thought"), {
		shape: [7500000],
		data_type: "float64",
		chunk_shape: [42],
	});

	let resb = await get(b, [zarr.slice(10)]);
	expect(resb.shape).toStrictEqual([10]);
	expect(resb.data).toStrictEqual(new Float64Array(10));

	expected.fill(1, 0, 5);
	await set(b, [zarr.slice(5)], 1);
	expect((await get(b, [zarr.slice(10)])).data).toStrictEqual(
		new Float64Array(10).fill(1, 0, 5),
	);
});
