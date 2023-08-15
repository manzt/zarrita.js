import { afterEach, describe, expect, it, vi } from "vitest";

import FetchStore from "../src/fetch.js";

// `vitest --api` exposes the port 51204
// ref: https://vitest.dev/config/#api
let href = "http://localhost:51204/fixtures/v3/data.zarr";

describe("FetchStore", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("reads a file from string url", async () => {
		let store = new FetchStore(href);
		let bytes = await store.get("/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "node_type": "group",
			  "zarr_format": 3,
			}
		`);
	});

	it("reads a file from URL", async () => {
		let store = new FetchStore(new URL(href));
		let bytes = await store.get("/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "node_type": "group",
			  "zarr_format": 3,
			}
		`);
	});

	it("returns undefined for missing file", async () => {
		let store = new FetchStore(href);
		expect(await store.get("/missing.json")).toBeUndefined();
	});

	it("it forwards request options to fetch", async () => {
		let headers = { "x-test": "test" };
		let store = new FetchStore(href);
		let spy = vi.spyOn(globalThis, "fetch");
		await store.get("/zarr.json", { headers });
		expect(spy).toHaveBeenCalledWith(href + "/zarr.json", { headers });
	});

	it("it forwards request options to fetch when configured globally", async () => {
		let headers = { "x-test": "test" };
		let store = new FetchStore(href, { headers });
		let spy = vi.spyOn(globalThis, "fetch");
		await store.get("/zarr.json");
		expect(spy).toHaveBeenCalledWith(href + "/zarr.json", { headers });
	});
});
