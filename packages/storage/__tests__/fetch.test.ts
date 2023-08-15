import { afterEach, describe, expect, it, vi } from "vitest";

import FetchStore from "../src/fetch.js";

describe("FetchStore", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("reads a file from string url", async () => {
		let store = new FetchStore("http://localhost:51204/fixtures/v3/data.zarr");
		expect(await store.get("/zarr.json")).toMatchInlineSnapshot(`
			Uint8Array [
			  123,
			  34,
			  97,
			  116,
			  116,
			  114,
			  105,
			  98,
			  117,
			  116,
			  101,
			  115,
			  34,
			  58,
			  32,
			  123,
			  125,
			  44,
			  32,
			  34,
			  122,
			  97,
			  114,
			  114,
			  95,
			  102,
			  111,
			  114,
			  109,
			  97,
			  116,
			  34,
			  58,
			  32,
			  51,
			  44,
			  32,
			  34,
			  110,
			  111,
			  100,
			  101,
			  95,
			  116,
			  121,
			  112,
			  101,
			  34,
			  58,
			  32,
			  34,
			  103,
			  114,
			  111,
			  117,
			  112,
			  34,
			  125,
			]
		`);
	});
	it("reads a file from URL", async () => {
		let store = new FetchStore(
			new URL("http://localhost:51204/fixtures/v3/data.zarr"),
		);
		expect(await store.get("/zarr.json")).toMatchInlineSnapshot(`
			Uint8Array [
			  123,
			  34,
			  97,
			  116,
			  116,
			  114,
			  105,
			  98,
			  117,
			  116,
			  101,
			  115,
			  34,
			  58,
			  32,
			  123,
			  125,
			  44,
			  32,
			  34,
			  122,
			  97,
			  114,
			  114,
			  95,
			  102,
			  111,
			  114,
			  109,
			  97,
			  116,
			  34,
			  58,
			  32,
			  51,
			  44,
			  32,
			  34,
			  110,
			  111,
			  100,
			  101,
			  95,
			  116,
			  121,
			  112,
			  101,
			  34,
			  58,
			  32,
			  34,
			  103,
			  114,
			  111,
			  117,
			  112,
			  34,
			  125,
			]
		`);
	});
	it("returns undefined for missing file", async () => {
		let store = new FetchStore("http://localhost:51204/fixtures/v3/data.zarr");
		expect(await store.get("/missing.json")).toBeUndefined();
	});
	it("it forwards request options to fetch", async () => {
		let store = new FetchStore("http://localhost:51204/fixtures/v3/data.zarr");
		let spy = vi.spyOn(globalThis, "fetch");
		await store.get("/zarr.json", { headers: { "x-test": "test" } });
		expect(spy).toHaveBeenCalledWith(
			"http://localhost:51204/fixtures/v3/data.zarr/zarr.json",
			{ headers: { "x-test": "test" } },
		);
	});
	it("it forwards request options to fetch when configured globally", async () => {
		let store = new FetchStore("http://localhost:51204/fixtures/v3/data.zarr", {
			headers: { "x-test": "foo" },
		});
		let spy = vi.spyOn(globalThis, "fetch");
		await store.get("/zarr.json");
		expect(spy).toHaveBeenCalledWith(
			"http://localhost:51204/fixtures/v3/data.zarr/zarr.json",
			{ headers: { "x-test": "foo" } },
		);
	});
});
