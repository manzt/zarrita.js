import type { AbsolutePath, AsyncReadable } from "@zarrita/storage";
import { expectType } from "tintype";
import { describe, test } from "vitest";
import * as zarr from "../src/index.js";
import { defineStoreMiddleware } from "../src/middleware/define.js";

describe("storeFrom", () => {
	test("no middleware returns store as-is", () => {
		let store = zarr.storeFrom(new zarr.FetchStore(""));
		expectType(store).toMatchInlineSnapshot(`Promise<zarr.FetchStore>`);
	});

	test("direct form in pipeline infers store options", () => {
		let store = zarr.storeFrom(new zarr.FetchStore(""), (s) =>
			zarr.withRangeBatching(s, {
				mergeOptions: (batch) => {
					expectType(batch).toMatchInlineSnapshot(
						`ReadonlyArray<RequestInit | undefined>`,
					);
					return batch[0];
				},
			}),
		);
		expectType(store).toMatchInlineSnapshot(`
			Promise<
				Required<AsyncReadable<RequestInit>> & {
					stats: Readonly<zarr.RangeBatchingStats>;
					url: string | URL;
				}
			>
		`);
	});

	test("no-config middleware can be passed uncalled", () => {
		function check() {
			return zarr.storeFrom(
				new zarr.FetchStore(""),
				zarr.withConsolidation,
				(s) => zarr.withRangeBatching(s, { mergeOptions: (batch) => batch[0] }),
			);
		}
		expectType(check).toMatchInlineSnapshot(`
			() => Promise<
				Required<AsyncReadable<RequestInit>> & {
					stats: Readonly<zarr.RangeBatchingStats>;
					url: string | URL;
					contents: () => { path: AbsolutePath; kind: "array" | "group" }[];
				}
			>
		`);
	});
});

describe("defineStoreMiddleware", () => {
	test("simple: extensions appear, store methods preserved", () => {
		let withCustom = defineStoreMiddleware(
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
			Required<AsyncReadable<RequestInit>> & {
				url: string | URL;
				hello: () => string;
			}
		`,
		);
	});

	test("generic: store Options flows into opts parameter", () => {
		interface ThingOptions<O> {
			storeOptions?: O;
			retries?: number;
		}

		let withThing = defineStoreMiddleware(
			<O>(store: AsyncReadable<O>, opts: ThingOptions<O>) => {
				return {
					async get(key: AbsolutePath, options?: O) {
						return store.get(key, options ?? opts.storeOptions);
					},
					retries: opts.retries ?? 3,
				};
			},
		);

		let store = withThing(new zarr.FetchStore(""), {
			storeOptions: { signal: AbortSignal.timeout(1000) },
			retries: 5,
		});
		expectType(store).toMatchInlineSnapshot(
			`
			Required<AsyncReadable<RequestInit>> & {
				url: string | URL;
				retries: number;
			}
		`,
		);
	});

	test("chaining preserves Options through wrappers", () => {
		let withA = defineStoreMiddleware(
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
		let withB = defineStoreMiddleware(
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
			Required<AsyncReadable<RequestInit>> & {
				url: string | URL;
				methodB: () => string;
				methodA: () => number;
			}
		`);
	});
});
