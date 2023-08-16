export { KeyError, NodeNotFoundError } from "./errors.js";
export { Array, Group, Location, root } from "./hierarchy.js";
export { open } from "./open.js";
export { create } from "./create.js";
export { registry } from "./codecs.js";
export { get_ctr, get_strides } from "./util.js";

/** @typedef {import("./metadata.js").Int8} Int8 */
/** @typedef {import("./metadata.js").Int16} Int16 */
/** @typedef {import("./metadata.js").Int32} Int32 */
/** @typedef {import("./metadata.js").Int64} Int64 */
/** @typedef {import("./metadata.js").Uint8} Uint8 */
/** @typedef {import("./metadata.js").Uint16} Uint16 */
/** @typedef {import("./metadata.js").Uint32} Uint32 */
/** @typedef {import("./metadata.js").Uint64} Uint64 */
/** @typedef {import("./metadata.js").Float32} Float32 */
/** @typedef {import("./metadata.js").Float64} Float64 */
/** @typedef {import("./metadata.js").Bool} Bool */
/** @typedef {import("./metadata.js").UnicodeStr} UnicodeStr */
/** @typedef {import("./metadata.js").ByteStr} ByteStr */
/** @typedef {import("./metadata.js").NumberDataType} NumberDataType */
/** @typedef {import("./metadata.js").BigintDataType} BigintDataType */
/** @typedef {import("./metadata.js").StringDataType} StringDataType */
/** @typedef {import("./metadata.js").DataType} DataType */
/** @typedef {import("./metadata.js").GroupMetadata} GroupMetadata */
/**
 * @template {DataType} D
 * @typedef {import("./metadata.js").ArrayMetadata<D>} ArrayMetadata
 */
/**
 * @template {DataType} D
 * @typedef {import("./metadata.js").Scalar<D>} Scalar
 */
/**
 * @template {DataType} D
 * @typedef {import("./metadata.js").TypedArray<D>} TypedArray
 */
/**
 * @template {DataType} D
 * @typedef {import("./metadata.js").TypedArrayConstructor<D>} TypedArrayConstructor
 */
/**
 * @template {DataType} D
 * @typedef {import("./metadata.js").Chunk<D>} Chunk
 */
