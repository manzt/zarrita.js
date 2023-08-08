import {
	Array,
	Group,
	json_decode_object,
	json_encode_object,
	KeyError,
	NodeNotFoundError,
	registry,
	slice,
} from "@zarrita/core";

import type {
	ArrayMetadata,
	Attrs,
	CodecMetadata,
	CreateArrayProps,
	DataType,
	Scalar,
} from "@zarrita/core";

import type {
	AbsolutePath,
	Async,
	Readable,
	Writeable,
} from "@zarrita/storage";

export { registry, slice };

/** Zarr v2 Array Metadata. Stored as JSON with key `.zarray`. */
export interface ArrayMetadataV2<Dtype extends DataType> {
	zarr_format: 2;
	shape: number[];
	chunks: number[];
	dtype: Dtype;
	compressor: null | Record<string, any>;
	fill_value: Scalar<Dtype> | null;
	order: "C" | "F";
	filters: null | Record<string, any>[];
	dimension_separator?: "." | "/";
}

/** Zarr v2 Group Metadata. Stored as JSON with key `.zgroup`. */
export interface GroupMetadata {
	zarr_format: 2;
}

function key_prefix<Path extends AbsolutePath>(
	path: Path,
): Path extends "/" ? "/" : `${Path}/` {
	// @ts-ignore
	return path === "/" ? path : `${path}/`;
}

const array_meta_key = (path: AbsolutePath) =>
	`${key_prefix(path)}.zarray` as const;

const group_meta_key = (path: AbsolutePath) =>
	`${key_prefix(path)}.zgroup` as const;

const attrs_key = (path: AbsolutePath) => `${key_prefix(path)}.zattrs` as const;

function deref<
	Store extends Readable | Async<Readable>,
	Path extends string,
>(grp: Group<Store>, path: Path): { store: Store; path: AbsolutePath };

function deref<Store>(
	store: Store,
	path: AbsolutePath,
): { store: Store; path: AbsolutePath };

function deref<Store extends Readable | Async<Readable>>(
	node: Store | Group<Store>,
	path: any,
) {
	if ("store" in node) {
		return { store: node.store, path: node.deref(path) };
	}
	return { store: node, path };
}

function v2_to_v3(meta: ArrayMetadataV2<DataType>): ArrayMetadata<DataType> {
	let codecs: CodecMetadata[] = [];
	for (let filter in meta.filters) {
		codecs.push(convert_codec_metadata(filter));
	}
	if (meta.compressor) {
		codecs.push(convert_codec_metadata(meta.compressor));
	}
	return {
		zarr_format: 3,
		node_type: "array",
		shape: meta.shape,
		data_type: meta.dtype,
		chunk_grid: {
			name: "regular",
			configuration: {
				chunk_shape: meta.chunks,
			},
		},
		chunk_key_encoding: {
			name: "v2",
			configuration: {
				separator: meta.dimension_separator ?? ".",
			},
		},
		codecs,
		fill_value: meta.fill_value,
		attributes: {},
	};
}

async function _get_array<
	Store extends Readable | Async<Readable>,
>(store: Store, path: AbsolutePath) {
	const meta_key = array_meta_key(path);
	const meta_doc = await store.get(meta_key);
	if (!meta_doc) {
		throw new NodeNotFoundError(path);
	}
	const meta: ArrayMetadataV2<DataType> = json_decode_object(meta_doc);
	return new Array(store, path, v2_to_v3(meta));
}

/**
 * Open Array relative to Group
 *
 * ```typescript
 * let grp = await zarr.get_group(store, "/path/to/grp");
 * let arr = await zarr.get_array(grp, "array");
 * // or
 * let arr = await zarr.get_array(grp, "/path/to/grp/array");
 * ```
 */
export function get_array<
	Store extends Readable | Async<Readable>,
>(
	group: Group<Store>,
	path: string,
): Promise<Array<DataType, Store>>;

/**
 * Open Array from store using an absolute path
 *
 * ```typescript
 * let arr = await get_array(store, "/path/to/array");
 * ```
 */
export function get_array<
	Store extends Readable | Async<Readable>,
>(store: Store, path: AbsolutePath): Promise<Array<DataType, Store>>;

/**
 * Open root as Array
 *
 * ```typescript
 * let arr = await get_array(store);
 * ```
 */
export function get_array<
	Store extends Readable | Async<Readable>,
>(store: Store): Promise<Array<DataType, Store>>;

/**
 * Open an Array from a Group or Store.
 * @category Read
 */
export async function get_array<Store extends Readable | Async<Readable>>(
	node: Store | Group<Store>,
	_path: any = "/",
) {
	const { store, path } = deref(node, _path);
	return _get_array(store as Store, path);
}

async function _get_group<
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath,
>(store: Store, path: Path) {
	const meta_key = group_meta_key(path);
	const meta_doc = await store.get(meta_key);
	if (!meta_doc) {
		throw new NodeNotFoundError(path);
	}
	// TODO: lazy
	return new Group(store, path, {
		zarr_format: 3,
		node_type: "group",
		attributes: {},
	});
}

/**
 * Open Group relative to another Group
 *
 * ```typescript
 * let group = await zarr.get_group(grp, "path/to/grp");
 * ```
 */
export function get_group<
	Store extends Readable | Async<Readable>,
>(
	group: Group<Store>,
	path: string,
): Promise<Group<Store>>;

/**
 * Open Group from store via absolute path
 *
 * ```typescript
 * let group = await zarr.get_group(store, "/path/to/grp");
 * ```
 */
export function get_group<
	Store extends Readable | Async<Readable>,
>(store: Store, path: AbsolutePath): Promise<Group<Store>>;

/**
 * Open root as Group
 *
 * ```typescript
 * let group = await zarr.get_group(store);
 * ```
 */
export function get_group<
	Store extends Readable | Async<Readable>,
>(store: Store): Promise<Group<Store>>;

/**
 * Open Group from Store or anthoer Group
 * @category Read
 */
export async function get_group<
	Store extends Readable | Async<Readable>,
>(node: Store | Group<Store>, _path: any = "/") {
	const { store, path } = deref(node, _path);
	return _get_group(store as Store, path as AbsolutePath);
}

/**
 * Open Node (Group or Array) from another Group
 *
 * ```typescript
 * let node = await zarr.get(grp, "path/to/node");
 * if (node instanceof zarr.Group) {
 *   // zarr.Group
 * } else {
 *   // zarr.Array
 * }
 * ```
 */
export function get<
	Store extends Readable | Async<Readable>,
>(
	group: Group<Store>,
	path: string,
): Promise<
	Array<DataType, Store> | Group<Store>
>;

/**
 * Open Node (Group or Array) from store via absolute path
 *
 * ```typescript
 * let node = await zarr.get(store, "/path/to/node");
 * if (node instanceof zarr.Group) {
 *   // zarr.Group
 * } else {
 *   // zarr.Array
 * }
 * ```
 */
export function get<
	Store extends Readable | Async<Readable>,
>(
	store: Store,
	path: AbsolutePath,
): Promise<Array<DataType, Store> | Group<Store>>;

/**
 * Open root Node (Group or Array) from store
 *
 * ```typescript
 * let node = await zarr.get(store);
 * if (node instanceof zarr.Group) {
 *   // zarr.Group
 * } else {
 *   // zarr.Array
 * }
 * ```
 */
export function get<
	Store extends Readable | Async<Readable>,
>(store: Store): Promise<Array<DataType, Store> | Group<Store>>;

/** @category Read */
export async function get<Store extends Readable | Async<Readable>>(
	node: Store | Group<Store>,
	_path: any = "/",
) {
	const { store, path } = deref(node, _path);
	try {
		return await _get_array(store as Store, path);
	} catch (err) {
		if (!(err instanceof NodeNotFoundError)) {
			throw err;
		}
	}
	// try explicit group
	try {
		return await _get_group(store as Store, path);
	} catch (err) {
		if (!(err instanceof NodeNotFoundError)) {
			throw err;
		}
	}
	throw new KeyError(path);
}

async function _create_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends AbsolutePath,
>(
	store: Store,
	path: Path,
	attrs?: Attrs,
) {
	const meta_doc = json_encode_object({ zarr_format: 2 } as GroupMetadata);
	const meta_key = group_meta_key(path);
	await store.set(meta_key, meta_doc);
	if (attrs) {
		await store.set(
			attrs_key(path),
			json_encode_object(attrs),
		);
	}
	return new Group(store, path, {
		zarr_format: 3,
		node_type: "group",
		attributes: attrs || {},
	});
}

/**
 * Create Group relative to another Group.
 *
 * ```typescript
 * let root = await zarr.get_group(store);
 * let group = await zarr.create_group(root, "new/grp");
 * ```
 *
 * @category Creation
 */
export function create_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends string,
>(
	group: Group<Store>,
	path: string,
	props?: { attrs?: Attrs },
): Promise<Group<Store>>;

/**
 * Create Group from store via absolute path
 *
 * ```typescript
 * let group = await zarr.create_group(store, "/new/grp");
 * ```
 *
 * @category Creation
 */
export function create_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
>(
	store: Store,
	path: AbsolutePath,
	props?: { attrs?: Attrs },
): Promise<Group<Store>>;

export async function create_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
>(node: Store | Group<Store>, _path: any = "/", props: { attrs?: Attrs } = {}) {
	const { store, path } = deref(node, _path);
	return _create_group(store as Store, path as AbsolutePath, props.attrs);
}

function encode_codec_metadata({ name, configuration }: CodecMetadata) {
	return { id: name, ...configuration };
}

function convert_codec_metadata({ id: name, ...configuration }: any): CodecMetadata {
	return { name, configuration };
}

async function _create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Dtype extends DataType,
>(
	store: Store,
	path: AbsolutePath,
	props: CreateArrayProps<Dtype>,
) {
	const shape = props.shape;
	const dtype = props.dtype;
	const chunk_shape = props.chunk_shape;
	const compressor = props.compressor;
	const chunk_separator = props.chunk_separator ?? ".";
	const filters = props.filters;
	const order = props.order ?? "C";

	const meta: ArrayMetadataV2<Dtype> = {
		zarr_format: 2,
		shape,
		dtype,
		chunks: chunk_shape,
		dimension_separator: chunk_separator,
		order: order,
		fill_value: props.fill_value ?? null,
		filters: filters ? filters.map(encode_codec_metadata) : null,
		compressor: compressor ? encode_codec_metadata(compressor) : null,
	};

	// serialise and store metadata document
	const meta_doc = json_encode_object(meta);
	const meta_key = array_meta_key(path);

	await store.set(meta_key, meta_doc);

	if (props.attrs) {
		await store.set(
			attrs_key(path),
			json_encode_object(props.attrs),
		);
	}

	return new Array(store, path, v2_to_v3(meta));
}

/**
 * Create Array relative to a Group.
 *
 * ```typescript
 * let grp = zarr.get_group(store, "/path/to/grp");
 * let arr = await zarr.create_array(grp, "data", {
 *   dtype: "<i4",
 *   shape: [100, 100],
 *   chunk_shape: [20, 20],
 * });
 * ```
 *
 * @category Creation
 */
export function create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	NodePath extends AbsolutePath,
	Dtype extends DataType,
>(
	group: Group<Store>,
	path: string,
	props: CreateArrayProps<Dtype>,
): Promise<Array<Dtype, Store>>;

/**
 * Create Array in store via absolute path
 *
 * ```typescript
 * let arr = await zarr.create_array(store, "/data", {
 *   dtype: "<i4",
 *   shape: [100, 100],
 *   chunk_shape: [20, 20],
 * });
 * ```
 *
 * @category Creation
 */
export function create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Dtype extends DataType,
>(
	store: Store,
	path: AbsolutePath,
	props: CreateArrayProps<Dtype>,
): Promise<Array<Dtype>>;

export async function create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Dtype extends DataType,
>(node: Store | Group<Store>, _path: any, props: CreateArrayProps<Dtype>) {
	const { store, path } = deref(node, _path);
	return _create_array(store as Store, path as AbsolutePath, props);
}

/**
 * Check existence of Node (Group or Array) relative to Group
 *
 * ```typescript
 * let grp = zarr.get_group(store, "/path/to/grp");
 * await zarr.has(grp, "data")
 * await zarr.has(grp, "/path/to/grp/data");
 * ```
 */
export function has<Store extends Readable | Async<Readable>>(
	group: Group<Store>,
	path: string,
): Promise<boolean>;

/**
 * Check existence of Node (Group or Array) in store
 *
 * ```typescript
 * await zarr.has(store, "/path/to/grp/data");
 * ```
 */
export function has<Store extends Readable | Async<Readable>>(
	store: Store,
	path: AbsolutePath,
): Promise<boolean>;

/** @category Read */
export async function has<Store extends Readable | Async<Readable>>(
	node: Store | Group<Store>,
	_path: any,
) {
	const { store, path } = deref(node, _path);
	// TODO: implement using `has` if available on store.
	return get(store as Store, path as AbsolutePath).then(() => true)
		.catch((err) => {
			if (err instanceof KeyError) {
				return false;
			}
			throw err;
		});
}
