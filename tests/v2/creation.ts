import { test } from "uvu";
import * as assert from "uvu/assert";

import { create_array, create_group } from "../../src/v2";
import { json_decode_object } from "../../src/lib/util";

test("create root group", async () => {
	let store = new Map();
	let attrs = { hello: "world" };
	let grp = await create_group(store, "/", { attrs });
	assert.is(grp.path, "/");
	assert.equal(await grp.attrs(), attrs);
	assert.ok(store.has("/.zattrs"));
	assert.ok(store.has("/.zgroup"));
	assert.equal(
		json_decode_object(store.get("/.zgroup")),
		{ zarr_format: 2 },
	);
	assert.equal(
		json_decode_object(store.get("/.zattrs")),
		attrs,
	);
});

test("create nested group", async () => {
	let store = new Map();
	let attrs = { hello: "world" };
	let grp = await create_group(store, "/path/to/nested", { attrs });
	assert.is(grp.path, "/path/to/nested");
	assert.ok(store.has("/path/to/nested/.zattrs"));
	assert.ok(store.has("/path/to/nested/.zgroup"));
});

test("create relative and absolute groups", async () => {
	let store = new Map();
	let grp = await create_group(store, "/nested");
	let attrs = { foo: "bar" };
	await create_group(grp, "relative/path", { attrs });
	assert.ok(store.has("/nested/relative/path/.zgroup"));
	assert.ok(store.has("/nested/relative/path/.zattrs"));
	await create_group(grp, "/absolute/path");
	assert.ok(store.has("/absolute/path/.zgroup"));
	assert.ok(!store.has("/absolute/path/.zattrs"), "doesn't write attrs");
});

test("create root array", async () => {
	let store = new Map();
	await create_array(store, "/", {
		dtype: "<f4",
		shape: [3, 4, 5],
		chunk_shape: [2, 2, 2],
		attrs: { foo: "bar" },
	});
	assert.ok(store.has("/.zarray"));
	assert.ok(store.has("/.zattrs"));
	assert.equal(
		json_decode_object(store.get("/.zarray")),
		{
			zarr_format: 2,
			dtype: "<f4",
			shape: [3, 4, 5],
			chunks: [2, 2, 2],
			dimension_separator: ".",
			order: "C",
			compressor: null,
			filters: null,
			fill_value: null,
		},
	);
	assert.equal(
		json_decode_object(store.get("/.zattrs")),
		{ foo: "bar" },
	);
});

test("create multiple arrays", async () => {
	let store = new Map();
	await Promise.all([
		create_array(store, "/a", {
			dtype: "<f4",
			shape: [3, 4, 5],
			chunk_shape: [2, 2, 2],
		}),
		create_array(store, "/b", {
			dtype: "|u1",
			shape: [4, 4],
			chunk_shape: [1, 1],
		}),
	]);
	assert.equal(
		new Set(store.keys()),
		new Set(["/a/.zarray", "/b/.zarray"]),
	);
});

test("create group and array(s)", async () => {
	let store = new Map();
	await create_group(store, "/", { attrs: { foo: "bar" } });
	let grp = await create_group(store, "/nested");
	await Promise.all([
		create_array(grp, "a", {
			dtype: "<f4",
			shape: [3, 4, 5],
			chunk_shape: [2, 2, 2],
		}),
		create_array(grp, "/b", {
			dtype: "|u1",
			shape: [4, 4],
			chunk_shape: [1, 1],
			attrs: { hello: "world" },
		}),
	]);
	assert.equal(
		new Set(store.keys()),
		new Set([
			"/.zgroup",
			"/.zattrs",
			"/nested/.zgroup",
			"/nested/a/.zarray",
			"/b/.zarray",
			"/b/.zattrs",
		]),
	);
});

test.run();
