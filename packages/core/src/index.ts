export { KeyError, NodeNotFoundError } from "./errors.js";
export {
	BoolArray,
	ByteStringArray,
	UnicodeStringArray,
} from "./typedarray.js";
export { Array, Group, Location, root } from "./hierarchy.js";
export { open } from "./open.js";
export { create } from "./create.js";
export { registry } from "./codecs.js";
export { get, set } from "./indexing/ops.js";
export { slice } from "./indexing/util.js";
export { IndexError } from "./indexing/indexer.js";
export { withConsolidated, tryWithConsolidated } from "./consolidated.js";

export type { Listable } from "./consolidated.js";
export type * from "./metadata.js";
export type {
	Slice,
	Indices,
	Projection,
	GetOptions,
	SetOptions,
} from "./indexing/types.js";

// internal exports for @zarrita/ndarray
export { get as _zarrita_internal_get } from "./indexing/get.js";
export { set as _zarrita_internal_set } from "./indexing/set.js";
export { get_strides as _zarrita_internal_get_strides } from "./util.js";
export { slice_indices as _zarrita_internal_slice_indices } from "./indexing/util.js";
