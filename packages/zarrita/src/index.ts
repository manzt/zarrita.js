// re-export all the storage interface types
export type * from "@zarrita/storage";
// re-export fetch store from storage
export { FetchStore, FileSystemStore } from "@zarrita/storage";
// core
export { registry } from "./codecs.js";
export { create } from "./create.js";
export {
	CodecPipelineError,
	InvalidMetadataError,
	InvalidSelectionError,
	isZarritaError,
	NotFoundError,
	UnknownCodecError,
	UnsupportedError,
} from "./errors.js";
export { Array, Group, Location, root } from "./hierarchy.js";
// internal exports for @zarrita/ndarray
export { get as _zarrita_internal_get } from "./indexing/get.js";
export { get, set } from "./indexing/ops.js";
export { set as _zarrita_internal_set } from "./indexing/set.js";
export type {
	GetOptions,
	Indices,
	Projection,
	SetOptions,
	Slice,
} from "./indexing/types.js";
export {
	sel,
	slice,
	sliceIndices as _zarrita_internal_sliceIndices,
} from "./indexing/util.js";
export type * from "./metadata.js";
/** @deprecated Use {@linkcode ConsolidationOptions} instead. */
export type {
	ConsolidatedFormat,
	ConsolidationOptions,
	ConsolidationOptions as WithConsolidatedOptions,
	Listable,
} from "./middleware/consolidation.js";
// deprecated re-exports
/** @deprecated Use {@linkcode withConsolidation} instead. */
/** @deprecated Use {@linkcode withMaybeConsolidation} instead. */
export {
	withConsolidation,
	withConsolidation as withConsolidated,
	withMaybeConsolidation,
	withMaybeConsolidation as tryWithConsolidated,
} from "./middleware/consolidation.js";
export type { GenericOptions } from "./middleware/define.js";
export { defineStoreMiddleware } from "./middleware/define.js";
export { extendStore } from "./middleware/extend-store.js";
export type {
	RangeBatchingOptions,
	RangeBatchingStats,
} from "./middleware/range-batching.js";
// middleware
export { withRangeBatching } from "./middleware/range-batching.js";
export { open } from "./open.js";
export {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "./typedarray.js";
export { getStrides as _zarrita_internal_getStrides } from "./util.js";
