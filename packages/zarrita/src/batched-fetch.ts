import type { AbsolutePath, AsyncReadable, RangeQuery } from "@zarrita/storage";
import { UnsupportedError } from "./errors.js";

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

export interface Stats {
	hits: number;
	misses: number;
	mergedRequests: number;
	batchedRequests: number;
}

export interface BatchedRangeStoreOptions<Options> {
	/** Maximum number of entries in the LRU cache (default: 256). */
	cacheSize?: number;
	/** Byte gap threshold for merging adjacent ranges (default: 32768). */
	coalesceSize?: number;
	/**
	 * Merge options from all callers in a batch into a single value passed to
	 * the inner store. By default, the first caller's options win. Use this to
	 * combine `AbortSignal`s, merge headers, etc.
	 */
	mergeOptions?: (
		batch: ReadonlyArray<Options | undefined>,
	) => Options | undefined;
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
 * A store wrapper that batches concurrent `getRange()` calls within a single
 * microtask tick, merges adjacent byte ranges, and caches results in an LRU
 * cache. The cache assumes immutable data — there is no invalidation or TTL.
 *
 * Inspired by geotiff.js
 * {@link https://github.com/geotiffjs/geotiff.js/blob/master/src/source/blockedsource.js BlockedSource}.
 *
 * @remarks By default, `options` (e.g. `AbortSignal`, custom headers) are
 * taken from the first `getRange()` call that schedules a flush tick. Pass a
 * `mergeOptions` reducer to combine options from all callers in a batch.
 *
 * @see {@link withRangeBatching}
 */
export class BatchedRangeStore<Options = unknown>
	implements AsyncReadable<Options>
{
	#inner: AsyncReadable<Options>;
	#innerGetRange: NonNullable<AsyncReadable<Options>["getRange"]>;
	#pending: Map<AbsolutePath, PendingRequest[]> = new Map();
	#scheduled = false;
	#batchOptions: (Options | undefined)[] = [];
	#mergeOptions:
		| ((batch: ReadonlyArray<Options | undefined>) => Options | undefined)
		| undefined;
	#coalesceSize: number;
	#cache: LRUCache<Uint8Array | undefined>;
	#inflight: Map<string, Promise<Uint8Array | undefined>> = new Map();

	#stats: Stats = { hits: 0, misses: 0, mergedRequests: 0, batchedRequests: 0 };

	get stats(): Readonly<Stats> {
		return { ...this.#stats };
	}

	constructor(
		inner: AsyncReadable<Options>,
		options?: BatchedRangeStoreOptions<Options>,
	) {
		if (!inner.getRange) {
			throw new UnsupportedError(
				"BatchedRangeStore requires a store with getRange",
			);
		}
		this.#inner = inner;
		this.#innerGetRange = inner.getRange.bind(inner);
		this.#coalesceSize = options?.coalesceSize ?? DEFAULT_COALESCE_SIZE;
		this.#cache = new LRUCache(options?.cacheSize ?? 256);
		this.#mergeOptions = options?.mergeOptions;
	}

	get(key: AbsolutePath, options?: Options): Promise<Uint8Array | undefined> {
		return this.#inner.get(key, options);
	}

	getRange(
		key: AbsolutePath,
		range: RangeQuery,
		options?: Options,
	): Promise<Uint8Array | undefined> {
		// Suffix requests (shard index reads) bypass batching - file size
		// is unknown until the response arrives.
		if ("suffixLength" in range) {
			let cacheKey = `${key}\0suffix\0${range.suffixLength}`;
			if (this.#cache.has(cacheKey)) {
				this.#stats.hits++;
				return Promise.resolve(this.#cache.get(cacheKey));
			}
			// Deduplicate concurrent suffix requests (same pattern as #346)
			let inflight = this.#inflight.get(cacheKey);
			if (inflight) {
				this.#stats.hits++;
				return inflight;
			}
			this.#stats.misses++;
			let promise = this.#innerGetRange(key, range, options)
				.then((data) => {
					this.#cache.set(cacheKey, data);
					this.#inflight.delete(cacheKey);
					return data;
				})
				.catch((err) => {
					this.#inflight.delete(cacheKey);
					throw err;
				});
			this.#inflight.set(cacheKey, promise);
			return promise;
		}

		let { offset, length } = range;
		let cacheKey = `${key}\0${offset}\0${length}`;

		if (this.#cache.has(cacheKey)) {
			this.#stats.hits++;
			return Promise.resolve(this.#cache.get(cacheKey));
		}

		this.#stats.misses++;
		this.#stats.batchedRequests++;

		return new Promise((resolve, reject) => {
			let pending = this.#pending.get(key);
			if (!pending) {
				pending = [];
				this.#pending.set(key, pending);
			}
			pending.push({ offset, length, resolve, reject });

			this.#batchOptions.push(options);
			if (!this.#scheduled) {
				this.#scheduled = true;
				queueMicrotask(() => this.#flush());
			}
		});
	}

	async #flush(): Promise<void> {
		let batch = this.#batchOptions;
		this.#batchOptions = [];
		let work = new Map(this.#pending);
		this.#pending.clear();
		this.#scheduled = false;

		let options: Options | undefined;
		try {
			options = this.#mergeOptions ? this.#mergeOptions(batch) : batch[0];
		} catch (err) {
			for (let requests of work.values()) {
				for (let req of requests) req.reject(err);
			}
			return;
		}

		let pathPromises: Promise<void>[] = [];
		for (let [path, requests] of work) {
			requests.sort((a, b) => a.offset - b.offset);
			let groups = groupRequests(requests, this.#coalesceSize);
			this.#stats.mergedRequests += groups.length;
			pathPromises.push(this.#fetchGroups(path, groups, options));
		}
		await Promise.all(pathPromises);
	}

	async #fetchGroups(
		path: AbsolutePath,
		groups: RangeGroup[],
		options?: Options,
	): Promise<void> {
		await Promise.all(
			groups.map(async (group) => {
				try {
					let data = await this.#innerGetRange(
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
							this.#cache.set(cacheKey, undefined);
							req.resolve(undefined);
							continue;
						}
						let start = req.offset - group.offset;
						let slice = data.slice(start, start + req.length);
						this.#cache.set(cacheKey, slice);
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
export function withRangeBatching<Options>(
	store: AsyncReadable<Options>,
	options?: BatchedRangeStoreOptions<Options>,
): BatchedRangeStore<Options> {
	return new BatchedRangeStore(store, options);
}
