import type { Readable } from "@zarrita/storage";

/** Store keys stripped from Extensions to avoid poisoning Options. */
type StoreKeys = "get" | "getRange";

/** Strip store keys from the extension type so Options aren't poisoned. */
type Extensions<T> = {
	[K in Extract<Exclude<keyof T, StoreKeys>, string>]: T[K];
} & {};

/**
 * If the factory defines `getRange`, make it required on S (preserving S's
 * type signature). This ensures middleware that provides `getRange` (like
 * `withRangeBatching`) marks it as non-optional without polluting Options.
 */
type RequireOverrides<Ext, S> = "getRange" extends keyof Ext
	? "getRange" extends keyof S
		? Required<Pick<S, "getRange">>
		: // biome-ignore lint/complexity/noBannedTypes: intentional empty intersection
			{}
	: // biome-ignore lint/complexity/noBannedTypes: intentional empty intersection
		{};

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
		? Promise<S & Extensions<Inner> & RequireOverrides<Inner, S>>
		: S & Extensions<Ext> & RequireOverrides<Ext, S>;

// biome-ignore lint/suspicious/noExplicitAny: needed for overload disambiguation
type HasGet = { get: (...args: any[]) => any };

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
	factory: (store: Readable, opts: unknown) => unknown,
	store: Readable,
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

function isReadable(value: unknown): value is Readable {
	return (
		value !== null &&
		typeof value === "object" &&
		"get" in value &&
		typeof value.get === "function"
	);
}

function _dual(factory: (store: Readable, opts: unknown) => unknown) {
	return (...args: [unknown, ...unknown[]]) => {
		if (isReadable(args[0])) {
			return _apply(factory, args[0], args[1]);
		}
		return (store: Readable) => _apply(factory, store, args[0]);
	};
}

/**
 * Define a composable store wrapper ("middleware").
 *
 * The factory function receives the inner store and options, and returns an
 * object of overrides and extensions. Methods not returned are automatically
 * delegated to the inner store via Proxy.
 *
 * Overrides of `get`/`getRange` work at runtime via the Proxy, but their types
 * are stripped from the return type so that the original store's Options generic
 * is preserved through chains of wrappers.
 *
 * Supports both sync and async factories — if the factory returns a Promise,
 * the wrapper returns a Promise too.
 *
 * Returns a dual-callable function:
 * - Direct: `withX(store, opts)`
 * - Curried: `withX(opts)(store)` (for `createStore` pipelines)
 *
 * ## Simple case
 *
 * When your options don't depend on the store's request options type:
 *
 * ```ts
 * const withCaching = wrapStore(
 *   (store: AsyncReadable, opts: { maxSize: number }) => {
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
 * interface MyOptsFor extends GenericOptions {
 *   readonly options: { storeOptions?: this["_O"]; retries?: number };
 * }
 *
 * const withMyThing = wrapStore.generic<MyOptsFor>()(
 *   (store, opts) => { ... },
 * );
 *
 * // At the call site, storeOptions is inferred from the store:
 * withMyThing(fetchStore, { storeOptions: { signal } });
 * //                                       ^? RequestInit
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: generic constraint needs any for proper inference
export function wrapStore<F extends (store: any, opts?: any) => any>(
	factory: F,
): {
	<S extends Readable & HasGet>(
		store: S,
		opts?: Parameters<F>[1],
	): WrapperResult<ReturnType<F>, S>;
	(
		opts?: Parameters<F>[1],
	): <S extends Readable>(store: S) => WrapperResult<ReturnType<F>, S>;
} {
	// @ts-expect-error: factory is typed via F, runtime uses unknown
	return _dual(factory);
}

/**
 * Define a store wrapper whose options depend on the store's request options type.
 *
 * @see {@linkcode wrapStore} for full documentation and examples.
 */
wrapStore.generic = function generic<OptsLambda extends GenericOptions>() {
	return <Ext>(
		factory: (store: Readable, opts: Apply<OptsLambda, unknown>) => Ext,
	): {
		<S extends Readable & HasGet>(
			store: S,
			opts?: Apply<OptsLambda, InferStoreOpts<S>>,
		): WrapperResult<Ext, S>;
		(
			opts?: Apply<OptsLambda, unknown>,
		): <S extends Readable>(store: S) => WrapperResult<Ext, S>;
	} => {
		// @ts-expect-error: factory is typed via Ext, runtime uses unknown
		return _dual(factory);
	};
};
