import type { AsyncReadable } from "@zarrita/storage";

/** Store keys stripped from Extensions to avoid poisoning Options. */
type StoreKeys = "get" | "getRange";

/** Strip store keys from the extension type so Options aren't poisoned. */
type Extensions<T> = {
	[K in Extract<Exclude<keyof T, StoreKeys>, string>]: T[K];
} & {};

type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Collapse store-typed keys onto `AsyncReadable`, hide them from the combined
 * type, and show all extensions (from S and Ext) as a single merged object.
 */
type CollapseStore<T> = T extends AsyncReadable
	? (T extends { getRange: (...args: never[]) => unknown }
			? Required<AsyncReadable>
			: AsyncReadable) &
			Prettify<Omit<T, keyof AsyncReadable>>
	: T;

type WrapperResult<R, S> =
	R extends Promise<infer Inner>
		? Promise<CollapseStore<S & Extensions<Inner>>>
		: CollapseStore<S & Extensions<R>>;

function createProxy(
	store: object,
	overrides: Record<string | symbol, unknown>,
) {
	return new Proxy(store, {
		get(target, prop, receiver) {
			if (prop in overrides) {
				return overrides[prop];
			}
			return Reflect.get(target, prop, receiver);
		},
		has(target, prop) {
			return prop in overrides || Reflect.has(target, prop);
		},
		ownKeys(target) {
			let keys = new Set([
				...Reflect.ownKeys(target),
				...Object.keys(overrides),
			]);
			return [...keys];
		},
		getOwnPropertyDescriptor(target, prop) {
			if (prop in overrides) {
				return {
					configurable: true,
					enumerable: true,
					value: overrides[prop],
				};
			}
			return Reflect.getOwnPropertyDescriptor(target, prop);
		},
	});
}

type FactoryResult = Partial<AsyncReadable> & Record<string, unknown>;

function assertFactoryResult(
	value: unknown,
): asserts value is Record<string | symbol, unknown> {
	if (value == null || typeof value !== "object") {
		throw new Error(
			"Store middleware factory must return an object of overrides",
		);
	}
}

/**
 * Define a composable store middleware.
 *
 * The factory function receives the inner store and options, and returns an
 * object of overrides and extensions. Methods not returned are automatically
 * delegated to the inner store via Proxy.
 *
 * Supports both sync and async factories — if the factory returns a Promise,
 * the middleware returns a Promise too.
 *
 * ```ts
 * import * as zarr from "zarrita";
 *
 * const withCaching = zarr.defineStoreMiddleware(
 *   (store, opts: { maxSize: number }) => {
 *     return {
 *       async get(key, options) { ... },
 *       clear() { ... },
 *     };
 *   },
 * );
 * ```
 */
export function defineStoreMiddleware<
	R extends FactoryResult | Promise<FactoryResult>,
	Opts = void,
>(
	factory: (store: AsyncReadable, opts: Opts) => R,
): <S extends AsyncReadable>(store: S, opts?: Opts) => WrapperResult<R, S>;
export function defineStoreMiddleware(
	factory: (store: AsyncReadable, opts: never) => unknown,
): (store: AsyncReadable, opts?: unknown) => unknown {
	return (store, opts) => {
		// @ts-expect-error - factory's opts parameter is wider than `never` at runtime.
		let result: unknown = factory(store, opts);
		if (result instanceof Promise) {
			return result.then((overrides) => {
				assertFactoryResult(overrides);
				return createProxy(store, overrides);
			});
		}
		assertFactoryResult(result);
		return createProxy(store, result);
	};
}
