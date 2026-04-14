import type { AbsolutePath, RangeQuery } from "@zarrita/storage";
import { defineStoreExtension } from "./define.js";

/**
 * Minimal byte cache interface — the storage primitive that
 * {@linkcode withByteCaching} uses to remember store responses. `has`
 * distinguishes "cached as `undefined`" (a confirmed not-found) from
 * "not cached yet", which is why it's part of the interface even though
 * the values are `Uint8Array | undefined`.
 *
 * A plain `Map<string, Uint8Array | undefined>` already satisfies the
 * shape, and so does any third-party LRU library that exposes `has`,
 * `get`, and `set` — no adapter needed. zarrita ships no cache
 * implementation of its own; bring whatever eviction policy you want.
 */
export interface ByteCache {
	has(key: string): boolean;
	get(key: string): Uint8Array | undefined;
	set(key: string, value: Uint8Array | undefined): void;
}

/**
 * A policy function that decides whether (and how) a single store request
 * should be cached. Returns a string key to store the result under, or
 * `undefined` to skip caching this call.
 *
 * `range` is `undefined` for {@linkcode withByteCaching}'s `get()` path and
 * set to the request's `RangeQuery` for `getRange()`, so a single policy
 * can cover both methods.
 *
 * The default (if no `keyFor` is supplied) caches every request: whole-object
 * `get()` reads under `path`, and `getRange()` reads under a composite key
 * that encodes the offset and length (or suffix length). Supply your own
 * `keyFor` to narrow the policy (e.g. metadata-only, path-filtered,
 * shard-indices-only).
 */
export type CacheKeyFor = (
	path: AbsolutePath,
	range?: RangeQuery,
) => string | undefined;

/** Default policy: cache every request, disambiguating gets from ranges. */
const defaultKeyFor: CacheKeyFor = (path, range) => {
	if (range === undefined) return path;
	if ("suffixLength" in range) return `${path}\0s:${range.suffixLength}`;
	return `${path}\0r:${range.offset}:${range.length}`;
};

/**
 * Wrap a store with a byte cache. Both `get()` and `getRange()` are
 * intercepted; the optional {@linkcode CacheKeyFor} policy decides whether
 * and how each call is keyed, and the optional `cache` container decides
 * where the bytes live and how they're evicted.
 *
 * The two knobs are independent:
 *
 * - **Container (`cache`)**: any {@linkcode ByteCache}-compatible object.
 *   Omit it for an internal unbounded `Map`. Pass `new Map()` to hold a
 *   reference you can clear or inspect. Pass a third-party LRU (e.g.
 *   [`quick-lru`](https://github.com/sindresorhus/quick-lru)) for bounded
 *   eviction; no adapter needed as long as it implements `has`/`get`/`set`.
 * - **Policy (`keyFor`)**: any function of type {@linkcode CacheKeyFor}.
 *   The default caches every request (gets and ranges alike). Supply your
 *   own to narrow the policy, e.g. metadata-only, path-filtered, or
 *   shard-indices-only. Return `undefined` from the function to skip
 *   caching a call.
 *
 * ```ts
 * import * as zarr from "zarrita";
 *
 * // Default: unbounded internal Map, caches every get() and getRange().
 * let store = zarr.withByteCaching(base);
 *
 * // Bring your own container to control eviction or share the reference.
 * let cache = new Map<string, Uint8Array | undefined>();
 * let store2 = zarr.withByteCaching(base, { cache });
 * cache.clear();
 *
 * // Bring your own policy to narrow what gets cached. This one caches
 * // only whole-object reads of paths that look like zarr metadata files.
 * let store3 = zarr.withByteCaching(base, {
 *   keyFor(path, range) {
 *     if (range !== undefined) return undefined;
 *     return /\/(zarr\.json|\.zarray|\.zattrs|\.zgroup)$/.test(path)
 *       ? path
 *       : undefined;
 *   },
 * });
 * ```
 */
export const withByteCaching = defineStoreExtension(
	(inner, opts: { cache?: ByteCache; keyFor?: CacheKeyFor } = {}) => {
		let cache = opts.cache ?? new Map<string, Uint8Array | undefined>();
		let keyFor = opts.keyFor ?? defaultKeyFor;
		let innerGetRange = inner.getRange?.bind(inner);
		return {
			async get(path, options) {
				let k = keyFor(path);
				if (k !== undefined && cache.has(k)) return cache.get(k);
				let value = await inner.get(path, options);
				if (k !== undefined) cache.set(k, value);
				return value;
			},
			// Only install the getRange override when the inner store actually
			// supports it; otherwise the Proxy delegates the missing method
			// straight through to the inner, which handles the error.
			...(innerGetRange && {
				async getRange(path, range, options) {
					let k = keyFor(path, range);
					if (k !== undefined && cache.has(k)) return cache.get(k);
					let value = await innerGetRange(path, range, options);
					if (k !== undefined) cache.set(k, value);
					return value;
				},
			}),
		};
	},
);
