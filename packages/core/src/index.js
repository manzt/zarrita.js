export { KeyError, NodeNotFoundError } from "./errors.js";
export { Array, Group, Location, root } from "./hierarchy.js";
export { open } from "./open.js";
export { create } from "./create.js";
export { registry } from "./codecs.js";
export { get_ctr, get_strides } from "./util.js";

/** @typedef {import("./types.js").Int8} Int8 */
/** @typedef {import("./types.js").Int16} Int16 */
/** @typedef {import("./types.js").Int32} Int32 */
/** @typedef {import("./types.js").Int64} Int64 */
/** @typedef {import("./types.js").Uint8} Uint8 */
/** @typedef {import("./types.js").Uint16} Uint16 */
/** @typedef {import("./types.js").Uint32} Uint32 */
/** @typedef {import("./types.js").Uint64} Uint64 */
/** @typedef {import("./types.js").Float32} Float32 */
/** @typedef {import("./types.js").Float64} Float64 */
/** @typedef {import("./types.js").Bool} Bool */
/** @typedef {import("./types.js").UnicodeStr} UnicodeStr */
/** @typedef {import("./types.js").ByteStr} ByteStr */
/** @typedef {import("./types.js").NumberDataType} NumberDataType */
/** @typedef {import("./types.js").BigintDataType} BigintDataType */
/** @typedef {import("./types.js").StringDataType} StringDataType */
/** @typedef {import("./types.js").DataType} DataType */
/** @typedef {import("./types.js").GroupMetadata} GroupMetadata */
/**
 * @template {DataType} D
 * @typedef {import("./types.js").ArrayMetadata<D>} ArrayMetadata
 */
/**
 * @template {DataType} D
 * @typedef {import("./types.js").Scalar<D>} Scalar
 */
/**
 * @template {DataType} D
 * @typedef {import("./types.js").TypedArray<D>} TypedArray
 */
/**
 * @template {DataType} D
 * @typedef {import("./types.js").TypedArrayConstructor<D>} TypedArrayConstructor
 */
/**
 * @template {DataType} D
 * @typedef {import("./types.js").Chunk<D>} Chunk
 */
