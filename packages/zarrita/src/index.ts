// re-export all the storage interface types
export type * from "@zarrita/storage";
// re-export fetch store from storage
export { default as FetchStore } from "@zarrita/storage/fetch";
export type {
	BatchedRangeStoreOptions,
	Stats as RangeBatchingStats,
} from "./batched-fetch.js";
export { BatchedRangeStore, withRangeBatching } from "./batched-fetch.js";
export { registry } from "./codecs.js";
export type {
	ConsolidatedFormat,
	Listable,
	WithConsolidatedOptions,
} from "./consolidated.js";
export { tryWithConsolidated, withConsolidated } from "./consolidated.js";
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
export { open } from "./open.js";
export {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "./typedarray.js";
export { getStrides as _zarrita_internal_getStrides } from "./util.js";
