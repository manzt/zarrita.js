import { afterEach, assert, describe, expect, it, vi } from "vitest";

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
			  "consolidated_metadata": null,
			  "node_type": "group",
			  "zarr_format": 3,
			}
		`);
	});

	it("reads data when path contains spaces", async () => {
		let store = new FetchStore(href);
		let bytes = await store.get("/my group with spaces/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
			  "attributes": {
			    "description": "A group with spaces in the name",
			  },
			  "consolidated_metadata": null,
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
			  "consolidated_metadata": null,
			  "node_type": "group",
			  "zarr_format": 3,
			}
		`);
	});

	it("reads multi-part path", async () => {
		let store = new FetchStore(href);
		let bytes = await store.get("/1d.chunked.i2/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        2,
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
			  "codecs": [
			    {
			      "configuration": {
			        "endian": "little",
			      },
			      "name": "bytes",
			    },
			    {
			      "configuration": {
			        "blocksize": 0,
			        "clevel": 5,
			        "cname": "zstd",
			        "shuffle": "noshuffle",
			        "typesize": 4,
			      },
			      "name": "blosc",
			    },
			  ],
			  "data_type": "int16",
			  "dimension_names": null,
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    4,
			  ],
			  "storage_transformers": [],
			  "zarr_format": 3,
			}
		`);
	});

	it("returns undefined for missing file", async () => {
		let store = new FetchStore(href);
		expect(await store.get("/some/random/file/missing.duh")).toBeUndefined();
	});

	it("forwards request options to fetch", async () => {
		let headers = { "x-test": "test" };
		let store = new FetchStore(href);
		let spy = vi.spyOn(globalThis, "fetch");
		await store.get("/zarr.json", { headers });
		let request = spy.mock.calls[0][0];
		assert(request instanceof Request);
		expect(request.url).toBe(`${href}/zarr.json`);
		expect(request.headers.get("x-test")).toBe("test");
	});

	it("forwards request options to fetch when configured globally", async () => {
		let headers = { "x-test": "test" };
		let store = new FetchStore(href, { overrides: { headers } });
		let spy = vi.spyOn(globalThis, "fetch");
		await store.get("/zarr.json");
		let request = spy.mock.calls[0][0];
		assert(request instanceof Request);
		expect(request.url).toBe(`${href}/zarr.json`);
		expect(request.headers.get("x-test")).toBe("test");
	});

	it("merges request options", async () => {
		let overrides: RequestInit = {
			headers: { "x-test": "root", "x-test2": "root" },
			cache: "no-cache",
		};
		let store = new FetchStore(href, { overrides });
		let spy = vi.spyOn(globalThis, "fetch");
		await store.get("/zarr.json", { headers: { "x-test": "override" } });
		let request = spy.mock.calls[0][0];
		assert(request instanceof Request);
		expect(request.url).toBe(`${href}/zarr.json`);
		expect(request.headers.get("x-test")).toBe("override");
		expect(request.headers.get("x-test2")).toBe("root");
		expect(request.cache).toBe("no-cache");
	});

	it("reads partial - suffixLength", async () => {
		let store = new FetchStore(href);
		let bytes = await store.getRange("/zarr.json", { suffixLength: 50 });
		expect(new TextDecoder().decode(bytes)).toMatchInlineSnapshot(
			`
			"olidated_metadata": null,
			  "node_type": "group"
			}"
		`,
		);
	});

	it("reads partial - offset, length", async () => {
		let store = new FetchStore(href);
		let bytes = await store.getRange("/zarr.json", { offset: 4, length: 50 });
		expect(new TextDecoder().decode(bytes)).toMatchInlineSnapshot(
			`
			""attributes": {},
			  "zarr_format": 3,
			  "consolida"
		`,
		);
	});

	describe("custom fetch", () => {
		it("uses custom fetch for get requests", async () => {
			let customFetch = vi.fn((request: Request) => fetch(request));
			let store = new FetchStore(href, { fetch: customFetch });
			let bytes = await store.get("/zarr.json");
			expect(bytes).toBeInstanceOf(Uint8Array);
			expect(customFetch).toHaveBeenCalledOnce();
			let request = customFetch.mock.calls[0][0];
			expect(request).toBeInstanceOf(Request);
			expect(request.url).toBe(`${href}/zarr.json`);
		});

		it("uses custom fetch for getRange requests", async () => {
			let customFetch = vi.fn((request: Request) => fetch(request));
			let store = new FetchStore(href, { fetch: customFetch });
			let bytes = await store.getRange("/zarr.json", {
				offset: 4,
				length: 50,
			});
			expect(bytes).toBeInstanceOf(Uint8Array);
			expect(customFetch).toHaveBeenCalledOnce();
			let request = customFetch.mock.calls[0][0];
			expect(request.headers.get("Range")).toBe("bytes=4-53");
		});

		it("allows intercepting and modifying the request", async () => {
			let store = new FetchStore(href, {
				async fetch(request) {
					// Add a custom header before sending
					let modified = new Request(request, {
						headers: {
							...Object.fromEntries(request.headers),
							"x-custom": "test",
						},
					});
					return fetch(modified);
				},
			});
			let bytes = await store.get("/zarr.json");
			expect(bytes).toBeInstanceOf(Uint8Array);
		});

		it("allows remapping status codes", async () => {
			let store = new FetchStore("http://localhost:51204/does-not-exist", {
				async fetch(request) {
					let response = await fetch(request);
					// Remap any error to 404 (simulates S3 403 → 404 pattern)
					if (!response.ok && response.status !== 404) {
						return new Response(null, { status: 404 });
					}
					return response;
				},
			});
			let bytes = await store.get("/zarr.json");
			expect(bytes).toBeUndefined();
		});

		it("receives merged overrides in the request", async () => {
			let customFetch = vi.fn((request: Request) => fetch(request));
			let store = new FetchStore(href, {
				fetch: customFetch,
				overrides: { headers: { "x-base": "base" } },
			});
			await store.get("/zarr.json", {
				headers: { "x-request": "request" },
			});
			let request = customFetch.mock.calls[0][0];
			expect(request.headers.get("x-base")).toBe("base");
			expect(request.headers.get("x-request")).toBe("request");
		});

		it("allows setting headers on the request directly", async () => {
			let spy = vi.spyOn(globalThis, "fetch");
			let store = new FetchStore(href, {
				async fetch(request) {
					request.headers.set("Authorization", "Bearer test-token");
					return fetch(request);
				},
			});
			await store.get("/zarr.json");
			let request = spy.mock.calls[0][0];
			assert(request instanceof Request);
			expect(request.headers.get("Authorization")).toBe("Bearer test-token");
		});

		it("abort signal survives request transformation", async () => {
			let controller = new AbortController();
			let store = new FetchStore(href, {
				async fetch(request) {
					// Simulate presigning: clone request with a new URL
					let transformed = new Request(request.url, request);
					expect(transformed.signal).toBe(request.signal);
					expect(transformed.signal.aborted).toBe(false);
					controller.abort();
					expect(transformed.signal.aborted).toBe(true);
					throw transformed.signal.reason;
				},
			});
			await expect(
				store.get("/zarr.json", { signal: controller.signal }),
			).rejects.toThrow();
		});
	});
});
