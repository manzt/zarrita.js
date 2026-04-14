import type {
	AbsolutePath,
	AsyncReadable,
	GetOptions,
	RangeQuery,
	Readable,
} from "@zarrita/storage";
import { UnsupportedError } from "../errors.js";
import { defineStoreExtension } from "./define.js";

type RequiredGetRange = NonNullable<AsyncReadable["getRange"]>;

function assertRangeCapable(
	store: Readable,
): asserts store is AsyncReadable & { getRange: RequiredGetRange } {
	if (!store.getRange) {
		throw new UnsupportedError(
			"`zarr.withRangeCoalescing` requires a store with getRange",
		);
	}
}

function mergeSignals(
	signals: ReadonlyArray<AbortSignal | undefined>,
): AbortSignal | undefined {
	let present: AbortSignal[] = [];
	for (let s of signals) if (s) present.push(s);
	if (present.length === 0) return undefined;
	if (present.length === 1) return present[0];
	return AbortSignal.any(present);
}

interface PendingRequest {
	offset: number;
	length: number;
	signal?: AbortSignal;
	resolve: (value: Uint8Array | undefined) => void;
	reject: (reason: unknown) => void;
}

interface RangeGroup {
	offset: number;
	length: number;
	requests: PendingRequest[];
}

/**
 * Immutable report emitted once per microtask flush, per path, via the
 * optional `onFlush` callback. A fresh object is allocated per emission.
 */
export interface FlushReport {
	/** The store path this flush covered. */
	path: AbsolutePath;
	/** How many HTTP fetches the coalescer issued for this path. */
	groupCount: number;
	/** How many caller-level `getRange` requests were folded into those fetches. */
	requestCount: number;
	/** Total bytes requested across all groups (the sum of group lengths). */
	bytesFetched: number;
}

export interface RangeCoalescingOptions {
	/**
	 * Byte gap threshold: two pending requests separated by less than this
	 * many bytes are merged into a single fetch. Fetching across a small gap
	 * is cheaper than an extra round trip.
	 *
	 * Default: 32768 (matches geotiff.js's `BlockedSource` heuristic and
	 * Rust `object_store`'s `OBJECT_STORE_COALESCE_DEFAULT`).
	 */
	coalesceSize?: number;
	/**
	 * Optional observability hook. Called once per microtask flush, per path,
	 * with a fresh `FlushReport`. Errors thrown from the callback are
	 * swallowed via `console.warn`; async return values are ignored.
	 *
	 * Suffix-length range queries (`{ suffixLength }`) bypass batching and
	 * do not emit `onFlush`.
	 */
	onFlush?: (report: FlushReport) => void;
}

const DEFAULT_COALESCE_SIZE = 32768;

function groupRequests(
	sorted: PendingRequest[],
	coalesceSize: number,
): RangeGroup[] {
	if (sorted.length === 0) return [];
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

function emitFlush(
	onFlush: ((report: FlushReport) => void) | undefined,
	report: FlushReport,
): void {
	if (!onFlush) return;
	try {
		onFlush(report);
	} catch (err) {
		console.warn("withRangeCoalescing: onFlush threw, swallowing:", err);
	}
}

/**
 * Wraps a store with microtask-tick range batching: concurrent `getRange`
 * calls within a single microtask are grouped by path, coalesced across
 * small byte gaps, and issued as a single fetch per group. The coalesced
 * blob is sliced on return and each caller receives exactly the bytes they
 * asked for.
 *
 * `withRangeCoalescing` carries no cache state. Pair with `withByteCaching`
 * if you want cross-call caching.
 *
 * ```ts
 * import * as zarr from "zarrita";
 *
 * let store = zarr.withRangeCoalescing(
 *   new zarr.FetchStore("https://example.com/data.zarr"),
 *   { coalesceSize: 32768 },
 * );
 * ```
 */
export const withRangeCoalescing = defineStoreExtension(
	(_store, opts: RangeCoalescingOptions = {}) => {
		assertRangeCapable(_store);
		let store = _store;
		let boundGetRange = store.getRange.bind(store);

		let coalesceSize = opts.coalesceSize ?? DEFAULT_COALESCE_SIZE;
		let onFlush = opts.onFlush;

		let pending = new Map<AbsolutePath, PendingRequest[]>();
		let scheduled = false;

		async function flush(): Promise<void> {
			let work = new Map(pending);
			pending.clear();
			scheduled = false;

			let pathPromises: Promise<void>[] = [];
			for (let [path, requests] of work) {
				requests.sort((a, b) => a.offset - b.offset);
				let groups = groupRequests(requests, coalesceSize);
				emitFlush(onFlush, {
					path,
					groupCount: groups.length,
					requestCount: requests.length,
					bytesFetched: groups.reduce((sum, g) => sum + g.length, 0),
				});
				pathPromises.push(fetchGroups(path, groups));
			}
			await Promise.all(pathPromises);
		}

		async function fetchGroups(
			path: AbsolutePath,
			groups: RangeGroup[],
		): Promise<void> {
			await Promise.all(
				groups.map(async (group) => {
					let signal = mergeSignals(group.requests.map((r) => r.signal));
					try {
						let data = await boundGetRange(
							path,
							{ offset: group.offset, length: group.length },
							{ signal },
						);
						if (data && data.length < group.length) {
							throw new Error(
								`Short read: expected ${group.length} bytes but received ${data.length}`,
							);
						}
						for (let req of group.requests) {
							if (!data) {
								req.resolve(undefined);
								continue;
							}
							let start = req.offset - group.offset;
							let slice = data.slice(start, start + req.length);
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
			getRange(
				key: AbsolutePath,
				range: RangeQuery,
				options?: GetOptions,
			): Promise<Uint8Array | undefined> {
				// Suffix reads (shard index fetches) can't be coalesced because
				// file size is unknown until the response arrives. Pass through.
				if ("suffixLength" in range) {
					return boundGetRange(key, range, options);
				}

				let { offset, length } = range;
				return new Promise((resolve, reject) => {
					let reqs = pending.get(key);
					if (!reqs) {
						reqs = [];
						pending.set(key, reqs);
					}
					reqs.push({
						offset,
						length,
						signal: options?.signal,
						resolve,
						reject,
					});
					if (!scheduled) {
						scheduled = true;
						queueMicrotask(() => flush());
					}
				});
			},
		};
	},
);
