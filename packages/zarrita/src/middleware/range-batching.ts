import type { AbsolutePath, AsyncReadable, RangeQuery } from "@zarrita/storage";
import { UnsupportedError } from "../errors.js";
import { type GenericOptions, wrapStore } from "./define.js";

/** Narrow a Readable to AsyncReadable, throwing if getRange is missing. */
function asAsync(
	store: import("@zarrita/storage").Readable,
): AsyncReadable & { getRange: NonNullable<AsyncReadable["getRange"]> } {
	if (!store.getRange) {
		throw new UnsupportedError(
			"withRangeBatching requires a store with getRange",
		);
	}
	return store as AsyncReadable & {
		getRange: NonNullable<AsyncReadable["getRange"]>;
	};
}

/**
 * Simple LRU cache using Map insertion order.
 * Oldest entry (first key) is evicted when capacity is exceeded.
 */
class LRUCache<V> {
	#map = new Map<string, V>();
	#max: number;

	constructor(max: number) {
		this.#max = max;
	}

	has(key: string): boolean {
		return this.#map.has(key);
	}

	get(key: string): V | undefined {
		if (!this.#map.has(key)) {
			return undefined;
		}
		let value = this.#map.get(key) as V;
		// Move to end (most recently used)
		this.#map.delete(key);
		this.#map.set(key, value);
		return value;
	}

	set(key: string, value: V): void {
		this.#map.delete(key);
		this.#map.set(key, value);
		if (this.#map.size > this.#max) {
			// Evict oldest (first inserted)
			let first = this.#map.keys().next().value;
			if (first !== undefined) {
				this.#map.delete(first);
			}
		}
	}

	clear(): void {
		this.#map.clear();
	}
}

interface PendingRequest {
	offset: number;
	length: number;
	resolve: (value: Uint8Array | undefined) => void;
	reject: (reason: unknown) => void;
}

interface RangeGroup {
	offset: number;
	length: number;
	requests: PendingRequest[];
}

export interface RangeBatchingStats {
	hits: number;
	misses: number;
	mergedRequests: number;
	batchedRequests: number;
}

export interface RangeBatchingOptions<O = unknown> {
	/** Maximum number of entries in the LRU cache (default: 256). */
	cacheSize?: number;
	/** Byte gap threshold for merging adjacent ranges (default: 32768). */
	coalesceSize?: number;
	/**
	 * Merge options from all callers in a batch into a single value passed to
	 * the inner store. By default, the first caller's options win. Use this to
	 * combine `AbortSignal`s, merge headers, etc.
	 */
	mergeOptions?: (batch: ReadonlyArray<O | undefined>) => O | undefined;
}

/**
 * Default coalesce size (in bytes): two requests separated by less than this
 * are merged into a single fetch. Fetching across a small gap is cheaper than
 * an extra round trip. 32 KB matches geotiff.js's BlockedSource heuristic and
 * Rust object_store's `OBJECT_STORE_COALESCE_DEFAULT`.
 */
const DEFAULT_COALESCE_SIZE = 32768;

/**
 * Groups sorted requests into contiguous ranges, coalescing across small gaps.
 * Modelled after geotiff.js BlockedSource.groupBlocks().
 */
function groupRequests(
	sorted: PendingRequest[],
	coalesceSize: number,
): RangeGroup[] {
	if (sorted.length === 0) {
		return [];
	}
	let groups: RangeGroup[] = [];
	let current = [sorted[0]];
	let groupStart = sorted[0].offset;
	let groupEnd = sorted[0].offset + sorted[0].length;

	for (let i = 1; i < sorted.length; i++) {
		let req = sorted[i];
		let reqEnd = req.offset + req.length;
		if (req.offset <= groupEnd + coalesceSize) {
			current.push(req);
			groupEnd = Math.max(groupEnd, reqEnd);
		} else {
			groups.push({
				offset: groupStart,
				length: groupEnd - groupStart,
				requests: current,
			});
			current = [req];
			groupStart = req.offset;
			groupEnd = reqEnd;
		}
	}
	groups.push({
		offset: groupStart,
		length: groupEnd - groupStart,
		requests: current,
	});
	return groups;
}

/**
 * Wraps a store with range-batching: concurrent `getRange()` calls within a
 * single microtask tick are merged into fewer HTTP requests and cached in an
 * LRU cache.
 *
 * ```typescript
 * import * as zarr from "zarrita";
 *
 * let store = zarr.withRangeBatching(new zarr.FetchStore("https://example.com/data.zarr"));
 * ```
 */
/** @internal Type lambda for {@linkcode RangeBatchingOptions}. */
export interface RangeBatchingOptsFor extends GenericOptions {
	readonly options: RangeBatchingOptions<this["_O"]>;
}

export const withRangeBatching = wrapStore.generic<RangeBatchingOptsFor>()(
	(_store, opts: RangeBatchingOptions<unknown> = {}) => {
		let store = asAsync(_store);
		let boundGetRange = store.getRange.bind(store);

		let coalesceSize = opts.coalesceSize ?? DEFAULT_COALESCE_SIZE;
		let cache = new LRUCache<Uint8Array | undefined>(opts.cacheSize ?? 256);
		let inflight = new Map<string, Promise<Uint8Array | undefined>>();
		let mergeOptionsFn = opts.mergeOptions;

		let pending = new Map<AbsolutePath, PendingRequest[]>();
		let scheduled = false;
		let batchOptions: unknown[] = [];

		let _stats: RangeBatchingStats = {
			hits: 0,
			misses: 0,
			mergedRequests: 0,
			batchedRequests: 0,
		};

		async function flush(): Promise<void> {
			let batch = batchOptions;
			batchOptions = [];
			let work = new Map(pending);
			pending.clear();
			scheduled = false;

			let options: unknown;
			try {
				options = mergeOptionsFn ? mergeOptionsFn(batch) : batch[0];
			} catch (err) {
				for (let requests of work.values()) {
					for (let req of requests) req.reject(err);
				}
				return;
			}

			let pathPromises: Promise<void>[] = [];
			for (let [path, requests] of work) {
				requests.sort((a, b) => a.offset - b.offset);
				let groups = groupRequests(requests, coalesceSize);
				_stats.mergedRequests += groups.length;
				pathPromises.push(fetchGroups(path, groups, options));
			}
			await Promise.all(pathPromises);
		}

		async function fetchGroups(
			path: AbsolutePath,
			groups: RangeGroup[],
			options?: unknown,
		): Promise<void> {
			await Promise.all(
				groups.map(async (group) => {
					try {
						let data = await boundGetRange(
							path,
							{ offset: group.offset, length: group.length },
							options,
						);
						if (data && data.length < group.length) {
							throw new Error(
								`Short read: expected ${group.length} bytes but received ${data.length}`,
							);
						}
						for (let req of group.requests) {
							let cacheKey = `${path}\0${req.offset}\0${req.length}`;
							if (!data) {
								cache.set(cacheKey, undefined);
								req.resolve(undefined);
								continue;
							}
							let start = req.offset - group.offset;
							let slice = data.slice(start, start + req.length);
							cache.set(cacheKey, slice);
							req.resolve(slice);
						}
					} catch (err) {
						for (let req of group.requests) {
							req.reject(err);
						}
					}
				}),
			);
		}

		return {
			get(
				key: AbsolutePath,
				options?: unknown,
			): Promise<Uint8Array | undefined> {
				return store.get(key, options);
			},

			getRange(
				key: AbsolutePath,
				range: RangeQuery,
				options?: unknown,
			): Promise<Uint8Array | undefined> {
				// Suffix requests (shard index reads) bypass batching - file size
				// is unknown until the response arrives.
				if ("suffixLength" in range) {
					let cacheKey = `${key}\0suffix\0${range.suffixLength}`;
					if (cache.has(cacheKey)) {
						_stats.hits++;
						return Promise.resolve(cache.get(cacheKey));
					}
					// Deduplicate concurrent suffix requests
					let existing = inflight.get(cacheKey);
					if (existing) {
						_stats.hits++;
						return existing;
					}
					_stats.misses++;
					let promise = boundGetRange(key, range, options)
						.then((data) => {
							cache.set(cacheKey, data);
							inflight.delete(cacheKey);
							return data;
						})
						.catch((err) => {
							inflight.delete(cacheKey);
							throw err;
						});
					inflight.set(cacheKey, promise);
					return promise;
				}

				let { offset, length } = range;
				let cacheKey = `${key}\0${offset}\0${length}`;

				if (cache.has(cacheKey)) {
					_stats.hits++;
					return Promise.resolve(cache.get(cacheKey));
				}

				_stats.misses++;
				_stats.batchedRequests++;

				return new Promise((resolve, reject) => {
					let reqs = pending.get(key);
					if (!reqs) {
						reqs = [];
						pending.set(key, reqs);
					}
					reqs.push({ offset, length, resolve, reject });

					batchOptions.push(options);
					if (!scheduled) {
						scheduled = true;
						queueMicrotask(() => flush());
					}
				});
			},

			get stats(): Readonly<RangeBatchingStats> {
				return { ..._stats };
			},
		};
	},
);
