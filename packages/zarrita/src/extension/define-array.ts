import type { Readable } from "@zarrita/storage";
import type { Array } from "../hierarchy.js";
import type { DataType } from "../metadata.js";
import { assertFactoryResult, createProxy } from "./define.js";

/**
 * A function that wraps a `zarr.Array`, returning a (possibly asynchronous)
 * extended array. This is the shape of the list declared on a store
 * extension's `arrayExtensions` field and auto-applied by `zarr.open`.
 */
export type ArrayExtension = (
	array: Array<DataType, Readable>,
) => Array<DataType, Readable> | Promise<Array<DataType, Readable>>;

/** Array keys whose overrides are intercepted by the extension. */
type ArrayOverrideKeys = "getChunk";

/** Strip array keys from extensions so Array's own surface isn't duplicated. */
type Extensions<T> = {
	[K in Extract<Exclude<keyof T, ArrayOverrideKeys>, string>]: T[K];
} & {};

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type WrapperResult<R, A> =
	R extends Promise<infer Inner>
		? Promise<A & Prettify<Extensions<Inner>>>
		: A & Prettify<Extensions<R>>;

type FactoryResult = Partial<
	Pick<Array<DataType, Readable>, ArrayOverrideKeys>
> &
	Record<string, unknown>;

/**
 * Define a composable array extension.
 *
 * The factory receives the inner `Array` and user options, and returns an
 * object of overrides and extensions. In v1 only `getChunk` is interceptable —
 * every other property (shape, dtype, attrs, path, store) is delegated to
 * the inner array via `Proxy`.
 *
 * The factory sees `Array<DataType, Readable>` (the widest form) so it can
 * be written once and applied to any concrete `Array<D, S>`. At the call
 * site the outer generics are preserved, so downstream `zarr.get(...)`
 * calls still return the right specific type.
 *
 * ```ts
 * import * as zarr from "zarrita";
 *
 * const withChunkCache = zarr.defineArrayExtension(
 *   (array, opts: { cache: Map<string, zarr.Chunk<zarr.DataType>> }) => ({
 *     async getChunk(coords, options) {
 *       let key = coords.join(",");
 *       let hit = opts.cache.get(key);
 *       if (hit) return hit;
 *       let chunk = await array.getChunk(coords, options);
 *       opts.cache.set(key, chunk);
 *       return chunk;
 *     },
 *   }),
 * );
 * ```
 */
export function defineArrayExtension<
	R extends FactoryResult | Promise<FactoryResult>,
	Opts = void,
>(
	factory: (array: Array<DataType, Readable>, opts: Opts) => R,
): <A extends Array<DataType, Readable>>(
	array: A,
	opts?: Opts,
) => WrapperResult<R, A>;
export function defineArrayExtension(
	factory: (array: Array<DataType, Readable>, opts: never) => unknown,
): (array: Array<DataType, Readable>, opts?: unknown) => unknown {
	return (array, opts) => {
		// @ts-expect-error - factory's opts parameter is wider than `never` at runtime.
		let result: unknown = factory(array, opts);
		if (result instanceof Promise) {
			return result.then((overrides) => {
				assertFactoryResult(overrides);
				return createProxy(array, overrides);
			});
		}
		assertFactoryResult(result);
		return createProxy(array, result);
	};
}
