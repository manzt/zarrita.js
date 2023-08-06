import { test, expect } from "vitest";

import { json_decode_object } from "@zarrita/core";
import * as zarr from "../index.js";

test("create root group", async () => {
	let store = new Map();
	let attrs = { hello: "world" };
	let grp = await zarr.create_group(store, "/", { attrs });
	expect(grp.path).toBe("/");
	expect(await grp.attrs()).toStrictEqual(attrs);
	expect(store.has("/.zattrs")).true;
	expect(store.has("/.zgroup")).true;
	expect(json_decode_object(store.get("/.zgroup"))).toStrictEqual({ zarr_format: 2 });
	expect(json_decode_object(store.get("/.zattrs"))).toStrictEqual(attrs);
});

test("create nested group", async () => {
	let store = new Map();
	let attrs = { hello: "world" };
	let grp = await zarr.create_group(store, "/path/to/nested", { attrs });
	expect(grp.path).toBe("/path/to/nested");
	expect(store.has("/path/to/nested/.zattrs")).true;
	expect(store.has("/path/to/nested/.zgroup")).true;
});

test("create relative and absolute groups", async () => {
	let store = new Map();
	let grp = await zarr.create_group(store, "/nested");
	let attrs = { foo: "bar" };
	await zarr.create_group(grp, "relative/path", { attrs });
	expect(store.has("/nested/relative/path/.zgroup")).true;
	expect(store.has("/nested/relative/path/.zattrs")).true;
	await zarr.create_group(grp, "/absolute/path");
	expect(store.has("/absolute/path/.zgroup")).true;
	expect(!store.has("/absolute/path/.zattrs"), "doesn't write attrs").true;
});

test("create root array", async () => {
	let store = new Map();
	await zarr.create_array(store, "/", {
		dtype: "<f4",
		shape: [3, 4, 5],
		chunk_shape: [2, 2, 2],
		attrs: { foo: "bar" },
	});
	expect(store.has("/.zarray")).true;
	expect(store.has("/.zattrs")).true;
	expect(json_decode_object(store.get("/.zarray"))).toStrictEqual(
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
	expect(json_decode_object(store.get("/.zattrs"))).toStrictEqual({ foo: "bar" });
});

test("create multiple arrays", async () => {
	let store = new Map();
	await Promise.all([
		zarr.create_array(store, "/a", {
			dtype: "<f4",
			shape: [3, 4, 5],
			chunk_shape: [2, 2, 2],
		}),
		zarr.create_array(store, "/b", {
			dtype: "|u1",
			shape: [4, 4],
			chunk_shape: [1, 1],
		}),
	]);
	expect(new Set(store.keys())).toStrictEqual(new Set(["/a/.zarray", "/b/.zarray"]));
});

test("create group and array(s)", async () => {
	let store = new Map();
	await zarr.create_group(store, "/", { attrs: { foo: "bar" } });
	let grp = await zarr.create_group(store, "/nested");
	await Promise.all([
		zarr.create_array(grp, "a", {
			dtype: "<f4",
			shape: [3, 4, 5],
			chunk_shape: [2, 2, 2],
		}),
		zarr.create_array(grp, "/b", {
			dtype: "|u1",
			shape: [4, 4],
			chunk_shape: [1, 1],
			attrs: { hello: "world" },
		}),
	]);
	expect(new Set(store.keys())).toStrictEqual(new Set([
			"/.zgroup",
			"/.zattrs",
			"/nested/.zgroup",
			"/nested/a/.zarray",
			"/b/.zarray",
			"/b/.zattrs",
		]));
});
