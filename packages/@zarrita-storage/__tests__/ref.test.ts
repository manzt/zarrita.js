import { afterEach, assert, describe, expect, it, vi } from "vitest";

import ReferenceStore from "../src/ref.js";

// zarr.json is 99 bytes of known text content served by vitest's API server
let zarrJsonUrl = "http://localhost:51204/fixtures/v3/data.zarr/zarr.json";

describe("ReferenceStore", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates store from async spec", async () => {
		let spec = Promise.resolve({
			version: 1,
			refs: {
				".zgroup": '{"zarr_format":2}',
			},
		});
		let store = await ReferenceStore.fromSpec(spec);
		let bytes = await store.get("/.zgroup");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
			  "zarr_format": 2,
			}
		`);
	});

	it("creates store from sync spec", () => {
		let store = ReferenceStore.fromSpec({
			version: 1,
			refs: {
				".zgroup": '{"zarr_format":2}',
			},
		});
		// sync spec returns ReferenceStore directly, not a Promise
		assert(store instanceof ReferenceStore);
	});

	it("returns undefined for missing keys", async () => {
		let store = ReferenceStore.fromSpec({
			version: 1,
			refs: { ".zgroup": '{"zarr_format":2}' },
		});
		assert(store instanceof ReferenceStore);
		let bytes = await store.get("/missing");
		expect(bytes).toBeUndefined();
	});

	it("reads inline string entries", async () => {
		let store = ReferenceStore.fromSpec({
			version: 1,
			refs: {
				".zgroup": '{"zarr_format":2}',
			},
		});
		assert(store instanceof ReferenceStore);
		let bytes = await store.get("/.zgroup");
		assert(bytes instanceof Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({
			zarr_format: 2,
		});
	});

	it("decodes base64 entries", async () => {
		let store = ReferenceStore.fromSpec({
			version: 1,
			refs: {
				// "hello" in base64
				"data.bin": "base64:aGVsbG8=",
			},
		});
		assert(store instanceof ReferenceStore);
		let bytes = await store.get("/data.bin");
		assert(bytes instanceof Uint8Array);
		expect(new TextDecoder().decode(bytes)).toBe("hello");
	});

	it("fetches remote references with [url, offset, length]", async () => {
		// zarr.json starts with '{\n  "attributes": {},'
		// first 22 bytes: '{\n  "attributes": {},'
		let store = ReferenceStore.fromSpec({
			version: 1,
			refs: {
				"meta.bin": [zarrJsonUrl, 0, 99],
			},
		});
		assert(store instanceof ReferenceStore);
		let bytes = await store.get("/meta.bin");
		assert(bytes instanceof Uint8Array);
		let text = new TextDecoder().decode(bytes);
		expect(JSON.parse(text)).toEqual({
			attributes: {},
			zarr_format: 3,
			consolidated_metadata: null,
			node_type: "group",
		});
	});

	it("composes range with remote reference offset", async () => {
		// Reference points at the full 99-byte file.
		// getRange with offset: 0, length: 20 should return first 20 bytes.
		let store = ReferenceStore.fromSpec({
			version: 1,
			refs: {
				"meta.bin": [zarrJsonUrl, 0, 99],
			},
		});
		assert(store instanceof ReferenceStore);
		let bytes = await store.getRange("/meta.bin", { offset: 0, length: 20 });
		assert(bytes instanceof Uint8Array);
		expect(bytes.length).toBe(20);
		let text = new TextDecoder().decode(bytes);
		expect(text).toMatchInlineSnapshot(`"{\n  "attributes": {}"`);
	});

	it("uses custom fetch for remote references", async () => {
		let customFetch = vi.fn((request: Request) => fetch(request));
		let store = ReferenceStore.fromSpec(
			{
				version: 1,
				refs: {
					"meta.bin": [zarrJsonUrl, 0, 99],
				},
			},
			{ fetch: customFetch },
		);
		assert(store instanceof ReferenceStore);
		await store.get("/meta.bin");
		expect(customFetch).toHaveBeenCalledOnce();
		let request = customFetch.mock.calls[0][0];
		assert(request instanceof Request);
		expect(request.headers.get("Range")).toBe("bytes=0-98");
	});

	it("does not call custom fetch for inline entries", async () => {
		let customFetch = vi.fn((request: Request) => fetch(request));
		let store = ReferenceStore.fromSpec(
			{
				version: 1,
				refs: {
					".zgroup": '{"zarr_format":2}',
					"data.bin": "base64:aGVsbG8=",
				},
			},
			{ fetch: customFetch },
		);
		assert(store instanceof ReferenceStore);
		await store.get("/.zgroup");
		await store.get("/data.bin");
		expect(customFetch).not.toHaveBeenCalled();
	});
});
