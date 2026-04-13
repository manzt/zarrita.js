import type { AbsolutePath, AsyncReadable } from "@zarrita/storage";
import { expectType } from "tintype";
import { describe, expect, test, vi } from "vitest";
import { defineStoreExtension } from "../src/extension/define.js";
import { defineArrayExtension } from "../src/extension/define-array.js";
import * as zarr from "../src/index.js";

describe("extendStore", () => {
	test("no extension returns store as-is", () => {
		let store = zarr.extendStore(new zarr.FetchStore(""));
		expectType(store).toMatchInlineSnapshot(`zarr.FetchStore`);
	});

	test("direct form in pipeline", () => {
		let store = zarr.extendStore(new zarr.FetchStore(""), (s) =>
			zarr.withRangeBatching(s),
		);
		expectType(store).toMatchInlineSnapshot(`
			Required<AsyncReadable> & {
				stats: Readonly<zarr.RangeBatchingStats>;
				url: string | URL;
			}
		`);
	});

	test("no-config extension can be passed uncalled", () => {
		function check() {
			return zarr.extendStore(
				new zarr.FetchStore(""),
				zarr.withConsolidation,
				(s) => zarr.withRangeBatching(s),
			);
		}
		expectType(check).toMatchInlineSnapshot(`
			() => Promise<
				Required<AsyncReadable> & {
					stats: Readonly<zarr.RangeBatchingStats>;
					url: string | URL;
					contents: () => { path: AbsolutePath; kind: "array" | "group" }[];
				}
			>
		`);
	});
});

describe("defineStoreExtension", () => {
	test("simple: extensions appear, store methods preserved", () => {
		let withCustom = defineStoreExtension(
			(store: AsyncReadable, _opts: { flag: boolean }) => {
				return {
					async get(key: AbsolutePath) {
						return store.get(key);
					},
					hello(): string {
						return "world";
					},
				};
			},
		);
		let store = withCustom(new zarr.FetchStore(""), { flag: true });
		expectType(store).toMatchInlineSnapshot(
			`
			Required<AsyncReadable> & {
				url: string | URL;
				hello: () => string;
			}
		`,
		);
	});

	test("chaining preserves store through wrappers", () => {
		let withA = defineStoreExtension(
			(store: AsyncReadable, _opts: { a: number }) => {
				return {
					async get(key: AbsolutePath) {
						return store.get(key);
					},
					methodA(): number {
						return 1;
					},
				};
			},
		);
		let withB = defineStoreExtension(
			(store: AsyncReadable, _opts: { b: string }) => {
				return {
					async get(key: AbsolutePath) {
						return store.get(key);
					},
					methodB(): string {
						return "hello";
					},
				};
			},
		);
		let store = withB(withA(new zarr.FetchStore(""), { a: 1 }), { b: "x" });
		expectType(store).toMatchInlineSnapshot(`
			Required<AsyncReadable> & {
				url: string | URL;
				methodB: () => string;
				methodA: () => number;
			}
		`);
	});
	test("function called in extension definition is only called once", async () => {
		const someInitializerFunction = vi.fn();
		let withCustom = defineStoreExtension(
			async (store: AsyncReadable, _opts: { flag: boolean }) => {
				await someInitializerFunction();
				return {
					async get(key: AbsolutePath) {
						return store.get(key);
					},
					hello(): string {
						return "world";
					},
				};
			},
		);
		let fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status: 404 }));
		try {
			let store = await withCustom(
				new zarr.FetchStore("http://example.invalid/"),
				{ flag: true },
			);
			await store.get("/path");
			expect(someInitializerFunction).toHaveBeenCalledTimes(1);
		} finally {
			fetchSpy.mockRestore();
		}
	});
});

describe("defineArrayExtension", () => {
	test("extensions appear, concrete D/S are preserved", () => {
		let withCounter = defineArrayExtension((_array) => ({
			bump(): void {},
			get count(): number {
				return 0;
			},
		}));
		// Simulate a typed Array; the wrapper should preserve <"int16", FetchStore>.
		function check(arr: zarr.Array<"int16", zarr.FetchStore>) {
			return withCounter(arr);
		}
		expectType(check).toMatchInlineSnapshot(`
			(
				arr: zarr.Array<"int16", zarr.FetchStore>,
			) => zarr.Array<"int16", zarr.FetchStore> & { bump: () => void; count: number }
		`);
	});
});
