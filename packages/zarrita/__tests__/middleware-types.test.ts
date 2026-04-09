import type { AbsolutePath, AsyncReadable } from "@zarrita/storage";
import { expectType } from "tintype";
import { describe, test } from "vitest";
import * as zarr from "../src/index.js";
import { wrapStore } from "../src/middleware/define.js";

describe("createStore", () => {
	test("no middleware returns store as-is", () => {
		let store = zarr.createStore(new zarr.FetchStore(""));
		expectType(store).toMatchInlineSnapshot(`Promise<zarr.FetchStore>`);
	});
});

describe("wrapStore", () => {
	test("simple: extensions appear, store methods preserved", () => {
		let withCustom = wrapStore(
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
			`zarr.FetchStore & { hello: () => string }`,
		);
	});

	test("generic: store Options flows into opts parameter", () => {
		interface ThingOptions<O> {
			storeOptions?: O;
			retries?: number;
		}

		let withThing = wrapStore(
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
			`zarr.FetchStore & { retries: number }`,
		);
	});

	test("chaining preserves Options through wrappers", () => {
		let withA = wrapStore((store: AsyncReadable, _opts: { a: number }) => {
			return {
				async get(key: AbsolutePath) {
					return store.get(key);
				},
				methodA(): number {
					return 1;
				},
			};
		});
		let withB = wrapStore((store: AsyncReadable, _opts: { b: string }) => {
			return {
				async get(key: AbsolutePath) {
					return store.get(key);
				},
				methodB(): string {
					return "hello";
				},
			};
		});
		let store = withB(withA(new zarr.FetchStore(""), { a: 1 }), { b: "x" });
		expectType(store).toMatchInlineSnapshot(`
			zarr.FetchStore & { methodA: () => number } & {
				methodB: () => string;
			}
		`);
	});
});
