import { test, expect, assert } from "vitest";
import ndarray from "ndarray";

import * as v3 from "../src/v3";
import { json_decode_object, range } from "../src/lib/util";
import { get, set } from "../src/ops";

import MemStore from "../src/storage/mem";

test("create root group", async () => {
	let h = await v3.create_hierarchy(new MemStore());
	let attrs = { hello: "world" };
	let grp = await v3.create_group(h, "/", { attrs });
	assert.equal(grp.path, "/");
	assert.equal(await grp.attrs(), attrs);
	assert.ok(h.store.has("/zarr.json"));
	assert.equal(
		json_decode_object(h.store.get("/zarr.json")!),
		{
			zarr_format: "https://purl.org/zarr/spec/protocol/core/3.0",
			metadata_encoding: "https://purl.org/zarr/spec/protocol/core/3.0",
			metadata_key_suffix: ".json",
			extensions: [],
		},
	);
	assert.ok(h.store.has("/meta/root.group.json"));
	assert.equal(
		json_decode_object(h.store.get("/meta/root.group.json")!),
		{
			extensions: [],
			attributes: attrs,
		},
	);
});

test("create array", async () => {
	let h = await v3.create_hierarchy(new MemStore());
	let attrs = { question: "life", answer: 42 };
	let a = await v3.create_array(h, "/arthur/dent", {
		shape: [5, 10],
		dtype: "<i4",
		chunk_shape: [2, 5],
		attrs,
	});
	assert.equal(a.path, "/arthur/dent");
	assert.equal(a.name, "dent");
	assert.equal(a.ndim, 2);
	assert.equal(a.shape, [5, 10]);
	assert.equal(a.dtype, "<i4");
	assert.equal(a.chunk_shape, [2, 5]);
	assert.equal(await a.attrs(), attrs);

	assert.ok(h.store.has("/meta/root/arthur/dent.array.json"));
	assert.equal(
		json_decode_object(h.store.get("/meta/root/arthur/dent.array.json")!),
		{
			shape: [5, 10],
			data_type: "<i4",
			chunk_grid: {
				type: "regular",
				chunk_shape: [2, 5],
				separator: "/",
			},
			chunk_memory_layout: "C",
			fill_value: null,
			extensions: [],
			attributes: attrs,
		},
	);
});

test("create group from another group", async () => {
	let h = await v3.create_hierarchy(new Map());
	let grp = await v3.create_group(h, "/tricia/mcmillan");
	await v3.create_group(grp, "relative");
	await v3.create_group(grp, "/absolute");
	assert.equal(
		new Set(h.store.keys()),
		new Set([
			"/zarr.json",
			"/meta/root/tricia/mcmillan.group.json",
			"/meta/root/tricia/mcmillan/relative.group.json",
			"/meta/root/absolute.group.json",
		]),
	);
});

test("create explicit group and access implicit group", async () => {
	let h = await v3.create_hierarchy(new MemStore());
	await v3.create_group(h, "/tricia/mcmillan");
	let grp = await v3.get_implicit_group(h, "/tricia");
	expect(grp).toBeInstanceOf(v3.ImplicitGroup);
});

test("create nodes via groups", async () => {
	let h = await v3.create_hierarchy(new MemStore());
	let marvin = await v3.create_group(h, "/marvin");
	let paranoid = await v3.create_group(marvin, "paranoid");
	let android = await v3.create_array(marvin, "android", {
		shape: [42, 42],
		dtype: "|u1",
		chunk_shape: [2, 2],
	});
	expect(marvin).toBeInstanceOf(v3.ExplicitGroup);
	assert.equal(marvin.path, "/marvin");
	expect(paranoid).toBeInstanceOf(v3.ExplicitGroup);
	assert.equal(paranoid.path, "/marvin/paranoid");
	expect(android).toBeInstanceOf(v3.Array);
	assert.equal(android.path, "/marvin/android");
});

test("get_children", async () => {
	let h = await v3.create_hierarchy(new MemStore());

	await v3.create_array(h, "/arthur/dent", {
		shape: [5, 10],
		dtype: "<i4",
		chunk_shape: [2, 5],
		attrs: { question: "life", answer: 42 },
	});

	await v3.create_array(h, "/deep/thought", {
		shape: [7500000],
		dtype: ">f8",
		chunk_shape: [42],
	});

	await v3.create_group(h, "/tricia/mcmillan");

	let marvin = await v3.create_group(h, "/marvin");
	await v3.create_group(marvin, "paranoid");
	await v3.create_array(marvin, "android", {
		shape: [42, 42],
		dtype: "|u1",
		chunk_shape: [2, 2],
	});

	assert.equal(
		await v3.get_children(h, "/"),
		new Map([
			["arthur", "implicit_group"],
			["deep", "implicit_group"],
			["marvin", "explicit_group"],
			["tricia", "implicit_group"],
		]),
	);

	assert.equal(
		await v3.get_children(h, "/tricia"),
		new Map().set("mcmillan", "explicit_group"),
	);

	assert.equal(
		await v3.get_children(h, "/arthur"),
		new Map().set("dent", "array"),
	);
});

test("get_nodes", async () => {
	let h = await v3.create_hierarchy(new MemStore());

	await v3.create_array(h, "/arthur/dent", {
		shape: [5, 10],
		dtype: "<i4",
		chunk_shape: [2, 5],
		attrs: { question: "life", answer: 42 },
	});

	await v3.create_array(h, "/deep/thought", {
		shape: [7500000],
		dtype: ">f8",
		chunk_shape: [42],
	});

	await v3.create_group(h, "/tricia/mcmillan");

	let marvin = await v3.create_group(h, "/marvin");
	await v3.create_group(marvin, "paranoid");
	await v3.create_array(marvin, "android", {
		shape: [42, 42],
		dtype: "|u1",
		chunk_shape: [2, 2],
	});

	assert.equal(
		await v3.get_children(h, "/"),
		new Map([
			["arthur", "implicit_group"],
			["deep", "implicit_group"],
			["marvin", "explicit_group"],
			["tricia", "implicit_group"],
		]),
	);

	assert.equal(
		await v3.get_children(h, "/tricia"),
		new Map().set("mcmillan", "explicit_group"),
	);

	assert.equal(
		await v3.get_children(h, "/arthur"),
		new Map().set("dent", "array"),
	);

	assert.equal(
		await v3.get_nodes(h),
		new Map([
			["/", "implicit_group"],
			["/arthur", "implicit_group"],
			["/arthur/dent", "array"],
			["/deep", "implicit_group"],
			["/deep/thought", "array"],
			["/marvin", "explicit_group"],
			["/marvin/android", "array"],
			["/marvin/paranoid", "explicit_group"],
			["/tricia", "implicit_group"],
			["/tricia/mcmillan", "explicit_group"],
		]),
	);
});

test("Read and write array data - builtin", async () => {
	let h = await v3.create_hierarchy(new MemStore());
	let a = await v3.create_array(h, "/arthur/dent", {
		shape: [5, 10],
		dtype: "<i4",
		chunk_shape: [2, 5],
	});

	let res = await get(a, [null, null]);
	assert.equal(res.shape, [5, 10]);
	assert.equal(res.data, new Int32Array(50));

	res = await get(a);
	assert.equal(res.shape, [5, 10]);
	assert.equal(res.data, new Int32Array(50));

	await set(a, [0, null], 42);
	assert.equal(
		(await get(a, null)).data,
		new Int32Array(50).fill(42, 0, 10),
	);

	const expected = new Int32Array(50).fill(42, 0, 10);
	[10, 20, 30, 40].forEach((i) => (expected[i] = 42));
	await set(a, [null, 0], 42);
	assert.equal(
		(await get(a, null)).data,
		expected,
	);

	await set(a, null, 42);
	expected.fill(42);
	assert.equal(
		(await get(a, null)).data,
		expected,
	);

	let arr = ndarray(new Int32Array([...Array(10).keys()]), [10]);
	expected.set(arr.data);
	await set(a, [0, null], arr);
	assert.equal((await get(a, null)).data, expected);

	arr = ndarray(new Int32Array(range(50)), [5, 10]);
	await set(a, null, arr);
	assert.equal(
		(await get(a, null)).data,
		arr.data,
	);

	// Read array slices
	res = await get(a, [null, 0]);
	assert.equal(res.shape, [5]);
	assert.equal(
		res.data,
		new Int32Array([0, 10, 20, 30, 40]),
	);

	res = await get(a, [null, 1]);
	assert.equal(res.shape, [5]);
	assert.equal(
		res.data,
		new Int32Array([1, 11, 21, 31, 41]),
	);

	res = await get(a, [0, null]);
	assert.equal(res.shape, [10]);
	assert.equal(
		res.data,
		new Int32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
	);

	res = await get(a, [1, null]);
	assert.equal(res.shape, [10]);
	assert.equal(
		res.data,
		new Int32Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
	);

	res = await get(a, [null, v3.slice(0, 7)]);
	assert.equal(res.shape, [5, 7]);
	// deno-fmt-ignore
	assert.equal(res.data, new Int32Array([ 
		 0,  1,  2,  3,  4,
		 5,  6, 10, 11, 12,
		13, 14, 15, 16, 20,
		21, 22, 23, 24, 25,
		26, 30, 31, 32, 33,
		34, 35, 36, 40, 41,
		42, 43, 44, 45, 46,
	]));

	res = await get(a, [v3.slice(0, 3), null]);
	assert.equal(res.shape, [3, 10]);
	// deno-fmt-ignore
	assert.equal(res.data, new Int32Array([
		 0,  1,  2,  3,  4,  5,  6,  7,  8,  9,
		10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
		20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
	]));
	res = await get(a, [v3.slice(0, 3), v3.slice(0, 7)]);
	assert.equal(res.shape, [3, 7]);
	// deno-fmt-ignore
	assert.equal(res.data, new Int32Array([
		 0,  1,  2,  3,  4,  5,  6,
		10, 11, 12, 13, 14, 15, 16,
		20, 21, 22, 23, 24, 25, 26,
	]));

	res = await get(a, [v3.slice(1, 4), v3.slice(2, 7)]);
	assert.equal(res.shape, [3, 5]);
	// deno-fmt-ignore
	assert.equal( res.data, new Int32Array([
		12, 13, 14, 15, 16,
		22, 23, 24, 25, 26,
		32, 33, 34, 35, 36,
	]));

	let b = await v3.create_array(h, "/deep/thought", {
		shape: [7500000],
		dtype: ">f8",
		chunk_shape: [42],
	});

	let resb = await get(b, [v3.slice(10)]);
	assert.equal(resb.shape, [10]);
	assert.equal(resb.data, new Float64Array(10));

	expected.fill(1, 0, 5);
	await set(b, [v3.slice(5)], 1);
	assert.equal(
		(await get(b, [v3.slice(10)])).data,
		new Float64Array(10).fill(1, 0, 5),
	);
});
