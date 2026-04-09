import type { AsyncReadable } from "@zarrita/storage";

/** Store keys stripped from Extensions to avoid poisoning Options. */
type StoreKeys = "get" | "getRange";

/** Strip store keys from the extension type so Options aren't poisoned. */
type Extensions<T> = {
	[K in Extract<Exclude<keyof T, StoreKeys>, string>]: T[K];
} & {};

/**
 * Base interface for defining middleware options that depend on the store's
 * request options type. Extend this and override `options` using `this["_O"]`:
 *
 * ```ts
 * interface MyOpts extends GenericOptions {
 *   readonly options: { storeOptions?: this["_O"]; retries?: number };
 * }
 * ```
 */
export interface GenericOptions {
	readonly _O: unknown;
	readonly options: unknown;
}

/** Apply a type lambda — substitutes `_O` with a concrete type. */
type Apply<F extends GenericOptions, O> = (F & { readonly _O: O })["options"];

/** Extract the Options type from a store. */
// biome-ignore lint/suspicious/noExplicitAny: required for conditional type matching
type InferStoreOpts<S> = S extends { get(key: any, opts?: infer O): any }
	? O
	: unknown;

/** If factory returns a Promise, wrap the result in Promise; otherwise keep it sync. */
type WrapperResult<Ext, S> =
	Ext extends Promise<infer Inner>
		? Promise<S & Extensions<Inner>>
		: S & Extensions<Ext>;

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

function _apply(
	factory: (store: AsyncReadable, opts: unknown) => unknown,
	store: AsyncReadable,
	opts: unknown,
) {
	let result = factory(store, opts);
	if (result instanceof Promise) {
		return result.then((overrides) =>
			createProxy(store, overrides as Record<string | symbol, unknown>),
		);
	}
	return createProxy(store, result as Record<string | symbol, unknown>);
}

/**
 * Define a composable store middleware.
 *
 * The factory function receives the inner store and options, and returns an
 * object of overrides and extensions. Methods not returned are automatically
 * delegated to the inner store via Proxy.
 *
 * Overrides of `get`/`getRange` work at runtime via the Proxy, but their types
 * are stripped from the return type so that the original store's Options generic
 * is preserved through chains of middleware.
 *
 * Supports both sync and async factories — if the factory returns a Promise,
 * the middleware returns a Promise too.
 *
 * ## Simple case
 *
 * When your options don't depend on the store's request options type:
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
 *
 * ## Generic case
 *
 * When your options need the store's request options type (e.g. for
 * `storeOptions` or `mergeOptions`), use {@linkcode GenericOptions}:
 *
 * ```ts
 * import * as zarr from "zarrita";
 *
 * interface MyOptsFor extends zarr.GenericOptions {
 *   readonly options: MyOptions<this["_O"]>;
 * }
 *
 * const withMyThing = zarr.defineStoreMiddleware.generic<MyOptsFor>()(
 *   (store, opts) => { ... },
 * );
 *
 * // At the call site, storeOptions is inferred from the store:
 * withMyThing(fetchStore, { storeOptions: { signal } });
 * //                                       ^? RequestInit
 * ```
 */
export function defineStoreMiddleware<
	// to correctly infer F's parameter types from the factory function.
	F extends (
		store: AsyncReadable,
		// biome-ignore lint/suspicious/noExplicitAny: `any` for opts is required for TypeScript
		opts?: any,
		// biome-ignore lint/suspicious/noExplicitAny: `any` for opts is required for TypeScript
	) => Partial<AsyncReadable> & Record<string, any>,
>(
	factory: F,
): <S extends AsyncReadable>(
	store: S,
	opts?: Parameters<F>[1],
) => WrapperResult<ReturnType<F>, S> {
	// @ts-expect-error - TypeScript can't infer this
	return (store: AsyncReadable, opts: unknown) => _apply(factory, store, opts);
}

/**
 * Define a store middleware whose options depend on the store's request options type.
 *
 * @see {@linkcode defineStoreMiddleware} for full documentation and examples.
 */
defineStoreMiddleware.generic = function generic<
	OptsLambda extends GenericOptions,
>() {
	// biome-ignore lint/suspicious/noExplicitAny: `any` allows extra extension properties
	return <Ext extends Partial<AsyncReadable> & Record<string, any>>(
		factory: (store: AsyncReadable, opts: Apply<OptsLambda, unknown>) => Ext,
	): (<S extends AsyncReadable>(
		store: S,
		opts?: NoInfer<Apply<OptsLambda, InferStoreOpts<S>>>,
	) => WrapperResult<Ext, S>) => {
		return ((store: AsyncReadable, opts: unknown) =>
			// biome-ignore lint/suspicious/noExplicitAny: TS can't figure it out
			_apply(factory, store, opts)) as any;
	};
};
