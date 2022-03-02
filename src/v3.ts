import { Array as BaseArray, ArrayProps, Group } from "./lib/hierarchy";
import { registry } from "./lib/codec-registry";
import { assert, KeyError, NodeNotFoundError, NotImplementedError } from "./lib/errors";
import { is_dtype, json_decode_object, json_encode_object } from "./lib/util";

import type {
	AbsolutePath,
	Async,
	Attrs,
	CreateArrayProps,
	DataType,
	Deref,
	ExtendedReadable,
	Readable,
	Scalar,
	Writeable,
} from "./types";

import type { DataTypeQuery, ExpandDataType } from "./dtypes";

import type { Codec } from "numcodecs";

export { slice } from "./lib/util";
export { registry } from "./lib/codec-registry";

export class Hierarchy<Store> {
	store: Store;
	meta_key_suffix: string;

	constructor({ store, meta_key_suffix }: { store: Store; meta_key_suffix: string }) {
		this.store = store;
		this.meta_key_suffix = meta_key_suffix;
	}

	get array_suffix() {
		return ".array" + this.meta_key_suffix;
	}

	get group_suffix() {
		return ".group" + this.meta_key_suffix;
	}
}

/** @category Node */
export class ImplicitGroup<Store, Path extends AbsolutePath = AbsolutePath>
	extends Group<Store, Path> {
	public owner: Hierarchy<Store>;
	constructor(props: { store: Store; owner: Hierarchy<Store>; path: Path }) {
		super(props);
		this.owner = props.owner;
	}
}

/** @category Node */
export class ExplicitGroup<Store, Path extends AbsolutePath = AbsolutePath>
	extends ImplicitGroup<Store, Path> {
	/** @hidden */
	private _attrs: Attrs;
	constructor(
		props: { store: Store; owner: Hierarchy<Store>; path: Path; attrs: Attrs },
	) {
		super(props);
		this._attrs = props.attrs;
	}
	async attrs() {
		return this._attrs;
	}
}

/** @category Node */
export class Array<
	Dtype extends DataType,
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath = AbsolutePath,
> extends BaseArray<Dtype, Store, Path> {
	/** @hidden */
	private _attrs: Attrs;
	constructor(props: ArrayProps<Dtype, Store, Path> & { attrs: Attrs }) {
		super(props);
		this._attrs = props.attrs;
	}
	/** @hidden */
	protected chunk_key(chunk_coords: number[]) {
		const chunk_identifier = "c" + chunk_coords.join(this.chunk_separator);
		return `/data/root${this.path}/${chunk_identifier}` as const;
	}
	async attrs() {
		return this._attrs;
	}

	is<Query extends DataTypeQuery>(
		query: Query,
	): this is Array<ExpandDataType<Dtype, Query>, Store, Path> {
		return is_dtype(this.dtype, query);
	}
}

interface RootMetadata {
	zarr_format: string;
	metadata_encoding: string;
	metadata_key_suffix: string;
	extensions: Record<string, unknown>[];
}

interface ArrayMetadata<D extends DataType> {
	shape: number[];
	data_type: D;
	chunk_grid: {
		type: "regular";
		separator: "/" | ".";
		chunk_shape: number[];
	};
	chunk_memory_layout: "C" | "F";
	fill_value: null | Scalar<D>;
	extensions: Record<string, any>[];
	attributes: Attrs;
	compressor?: CodecMetadata;
}

interface CodecMetadata {
	codec: string;
	configuration: Record<string, any>;
}

interface GroupMetadata {
	attributes: Attrs;
	extensions: Record<string, any>[];
}

function encode_codec_metadata(codec: Codec): CodecMetadata {
	// only support gzip for now
	const supported_codecs = new Set("gzip");
	// @ts-ignore
	const codec_id = codec.constructor.codecId;
	assert(
		!supported_codecs.has(codec_id),
		`codec not supported for metadata, got: ${codec_id}.`,
	);
	// @ts-ignore
	const config = { level: codec.level };
	const meta = {
		codec: "https://purl.org/zarr/spec/codec/gzip/1.0",
		configuration: config,
	};
	return meta;
}

async function decode_codec_metadata(meta: CodecMetadata): Promise<Codec> {
	// only support gzip for now
	if (meta.codec !== "https://purl.org/zarr/spec/codec/gzip/1.0") {
		throw new NotImplementedError(
			`No support for codec, got ${meta.codec}.`,
		);
	}
	const importer = registry.get("gzip");
	if (!importer) {
		throw new Error(`Missing gzip codec in registry.`);
	}
	const GZip = await importer();
	const codec = GZip.fromConfig(meta.configuration);
	return codec;
}

function meta_key<Path extends string, Suffix extends string>(
	path: Path,
	suffix: Suffix,
	node: "group" | "array",
) {
	if (path === "/") {
		// special case root path
		return `/meta/root.${node}${suffix}` as const;
	}
	return `/meta/root${path}.${node}${suffix}` as const;
}

/** @category Creation */
export async function create_hierarchy<Store extends Writeable | Async<Writeable>>(
	store: Store,
): Promise<Hierarchy<Store>> {
	// create entry point metadata document
	const meta_key_suffix = ".json";

	const meta: RootMetadata = {
		zarr_format: "https://purl.org/zarr/spec/protocol/core/3.0",
		metadata_encoding: "https://purl.org/zarr/spec/protocol/core/3.0",
		metadata_key_suffix: meta_key_suffix,
		extensions: [],
	};

	// serialise and store metadata document
	const entry_meta_doc = json_encode_object(meta);
	const entry_meta_key = "/zarr.json";
	await store.set(entry_meta_key, entry_meta_doc);

	// instantiate a hierarchy
	return new Hierarchy({ store, meta_key_suffix });
}

/** @category Getters */
export async function get_hierarchy<Store extends Readable | Async<Readable>>(
	store: Store,
): Promise<Hierarchy<Store>> {
	// retrieve and parse entry point metadata document
	const meta_key = "/zarr.json";
	const meta_doc = await store.get(meta_key);

	if (!meta_doc) {
		throw new NodeNotFoundError(meta_key);
	}

	const meta: RootMetadata = json_decode_object(meta_doc);

	// check protocol version
	const segments = meta.zarr_format.split("/");
	const protocol_version = segments.pop() || "";
	const protocol_uri = segments.join("/");
	if (protocol_uri !== "https://purl.org/zarr/spec/protocol/core") {
		throw new NotImplementedError(
			`No support for Protocol URI, got ${protocol_uri}.`,
		);
	}
	const protocol_major_version = protocol_version.split(".")[0];
	if (protocol_major_version !== "3") {
		throw new NotImplementedError(
			`No support for protocol version, got ${protocol_major_version}.`,
		);
	}

	// check metadata encoding
	if (
		meta.metadata_encoding !==
			"https://purl.org/zarr/spec/protocol/core/3.0"
	) {
		throw new NotImplementedError(
			`No support for metadata encoding, got ${meta.metadata_encoding}.`,
		);
	}

	// check extensions
	for (const spec of meta.extensions) {
		if (spec.must_understand) {
			throw new NotImplementedError(
				`No support for required extensions, got ${JSON.stringify(spec)}.`,
			);
		}
	}

	// instantiate hierarchy
	const meta_key_suffix = meta.metadata_key_suffix;
	return new Hierarchy({ store, meta_key_suffix });
}

function deref<
	Store,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	grp: ImplicitGroup<Store, NodePath>,
	path: Path,
): { hierarchy: Hierarchy<Store>; path: Deref<Path, NodePath> };

function deref<Store, Path extends AbsolutePath>(
	hierarchy: Hierarchy<Store>,
	path: Path,
): { hierarchy: Hierarchy<Store>; path: Path };

function deref<Store>(node: Hierarchy<Store> | ImplicitGroup<Store>, path: any) {
	if ("meta_key_suffix" in node) {
		return { hierarchy: node, path };
	}
	return { hierarchy: node.owner, path: node.deref(path) };
}

async function _create_group<
	Store extends Writeable | Async<Writeable>,
	Path extends AbsolutePath,
>(
	hierarchy: Hierarchy<Store>,
	path: Path,
	attrs: Attrs = {},
) {
	const meta: GroupMetadata = { extensions: [], attributes: attrs };
	const meta_doc = json_encode_object(meta);
	const key = meta_key(path, hierarchy.meta_key_suffix, "group");
	await hierarchy.store.set(key, meta_doc);
	return new ExplicitGroup({
		store: hierarchy.store,
		owner: hierarchy,
		path: path,
		attrs,
	});
}

/**
 * @param group [[`ExplicitGroup`]] or [[`ImplicitGroup`]]
 * @param path Treated as a relative path unless an abosolute path is provided
 * @param props Optionally specify attributes
 */
export async function create_group<
	Store extends Writeable | Async<Writeable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	group: ImplicitGroup<Store, NodePath>,
	path: Path,
	props?: { attrs?: Attrs },
): Promise<ExplicitGroup<Store, Deref<Path, NodePath>>>;

/** Create an `ExplicitGroup` from a `Hierarchy`. Must provide an abosolute path. */
export async function create_group<
	Store extends Writeable | Async<Writeable>,
	Path extends AbsolutePath,
>(
	hierarchy: Hierarchy<Store>,
	path: Path,
	props?: { attrs?: Attrs },
): Promise<ExplicitGroup<Store, Path>>;

/** @category Creation */
export async function create_group<
	Store extends Writeable | Async<Writeable>,
>(
	node: ImplicitGroup<Store> | Hierarchy<Store>,
	_path: any,
	props: { attrs?: Attrs } = {},
) {
	const { hierarchy, path } = deref(node as Hierarchy<Store>, _path as AbsolutePath);
	return _create_group(hierarchy, path, props.attrs);
}

async function _create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends AbsolutePath,
	Dtype extends DataType,
>(
	hierarchy: Hierarchy<Store>,
	path: Path,
	props: Omit<CreateArrayProps<Dtype>, "filters"> & { attrs?: Attrs },
) {
	const shape = props.shape;
	const dtype = props.dtype;
	const chunk_shape = props.chunk_shape;
	const compressor = props.compressor;
	const order = props.order ?? "C";

	const meta: ArrayMetadata<Dtype> = {
		shape,
		data_type: dtype,
		chunk_grid: {
			type: "regular",
			separator: props.chunk_separator ?? "/",
			chunk_shape,
		},
		chunk_memory_layout: order,
		fill_value: props.fill_value ?? null,
		extensions: [],
		attributes: props.attrs ?? {},
	};

	if (compressor) {
		meta.compressor = encode_codec_metadata(compressor);
	}

	// serialise and store metadata document
	const meta_doc = json_encode_object(meta);
	const key = meta_key(path, hierarchy.meta_key_suffix, "array");
	await hierarchy.store.set(key, meta_doc);

	return new Array({
		store: hierarchy.store,
		path,
		shape: meta.shape,
		dtype: dtype,
		chunk_shape: meta.chunk_grid.chunk_shape,
		chunk_separator: meta.chunk_grid.separator,
		compressor: compressor,
		fill_value: meta.fill_value,
		attrs: meta.attributes,
		order: order,
	});
}

export async function create_array<
	Dtype extends DataType,
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	group: ImplicitGroup<Store, NodePath>,
	path: Path,
	props: Omit<CreateArrayProps<Dtype>, "filters"> & { attrs?: Attrs },
): Promise<Array<Dtype, Store, Deref<Path, NodePath>>>;

export async function create_array<
	Dtype extends DataType,
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends AbsolutePath,
>(
	hierarchy: Hierarchy<Store>,
	path: Path,
	props: Omit<CreateArrayProps<Dtype>, "filters"> & { attrs?: Attrs },
): Promise<Array<Dtype, Store, Path>>;

/** @category Creation */
export async function create_array<
	Dtype extends DataType,
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
>(
	node: ImplicitGroup<Store> | Hierarchy<Store>,
	_path: any,
	props: Omit<CreateArrayProps<Dtype>, "filters"> & { attrs?: Attrs },
) {
	const { hierarchy, path } = deref(node as Hierarchy<Store>, _path as AbsolutePath);
	return _create_array(hierarchy as Hierarchy<Store>, path, props);
}

async function _get_array<
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath,
>(
	hierarchy: Hierarchy<Store>,
	path: Path,
) {
	const key = meta_key(path, hierarchy.meta_key_suffix, "array");
	const meta_doc = await hierarchy.store.get(key);

	if (!meta_doc) {
		throw new NodeNotFoundError(path);
	}

	const meta: ArrayMetadata<DataType> = json_decode_object(meta_doc);

	// decode and check metadata
	const {
		shape,
		data_type: dtype,
		chunk_grid,
		fill_value,
		chunk_memory_layout,
		extensions,
		attributes: attrs,
	} = meta;

	if (chunk_grid.type !== "regular") {
		throw new NotImplementedError(
			`Only support for "regular" chunk_grids, got ${chunk_grid.type}.`,
		);
	}

	for (const spec of extensions) {
		if (spec.must_understand) {
			throw new NotImplementedError(
				`No support for required extensions found, ${JSON.stringify(spec)}.`,
			);
		}
	}

	return new Array({
		store: hierarchy.store,
		path,
		shape: shape,
		dtype: dtype,
		chunk_shape: chunk_grid.chunk_shape,
		chunk_separator: chunk_grid.separator,
		compressor: meta.compressor
			? await decode_codec_metadata(meta.compressor)
			: undefined,
		fill_value,
		attrs,
		order: chunk_memory_layout,
	});
}

export async function get_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	group: ImplicitGroup<Store, NodePath>,
	path: Path,
): Promise<Array<DataType, Store, Deref<Path, NodePath>>>;

export async function get_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends AbsolutePath,
>(hierarchy: Hierarchy<Store>, path: Path): Promise<Array<DataType, Store, Path>>;

export async function get_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
>(hierarchy: Hierarchy<Store>): Promise<Array<DataType, Store, "/">>;

/** @category Getters */
export async function get_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
>(node: ImplicitGroup<Store> | Hierarchy<Store>, _path: any = "/") {
	const { hierarchy, path } = deref(node as Hierarchy<Store>, _path as AbsolutePath);
	return _get_array(hierarchy as Hierarchy<Store>, path);
}

async function _get_group<
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath,
>(
	hierarchy: Hierarchy<Store>,
	path: Path,
) {
	const key = meta_key(path, hierarchy.meta_key_suffix, "group");
	const meta_doc = await hierarchy.store.get(key);
	if (!meta_doc) {
		throw new NodeNotFoundError(path);
	}
	const meta: GroupMetadata = json_decode_object(meta_doc);
	return new ExplicitGroup({
		store: hierarchy.store,
		owner: hierarchy,
		path,
		attrs: meta.attributes,
	});
}

export async function get_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	group: ImplicitGroup<Store, NodePath>,
	path: Path,
): Promise<ExplicitGroup<Store, Deref<Path, NodePath>>>;

export async function get_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends AbsolutePath,
>(hierarchy: Hierarchy<Store>, path: Path): Promise<ExplicitGroup<Store, Path>>;

export async function get_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
>(hierarchy: Hierarchy<Store>): Promise<ExplicitGroup<Store, "/">>;

/** @category Getters */
export async function get_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
>(node: ImplicitGroup<Store> | Hierarchy<Store>, _path: any = "/") {
	const { hierarchy, path } = deref(node as Hierarchy<Store>, _path as AbsolutePath);
	return _get_group(hierarchy as Hierarchy<Store>, path);
}

async function _get_implicit_group<
	Store extends ExtendedReadable | Async<ExtendedReadable>,
	Path extends AbsolutePath,
>(h: Hierarchy<Store>, path: Path) {
	const key_prefix = (path as any) === "/"
		? "/meta/root/"
		: `/meta/root${path}/` as const;
	const res = await h.store.list_dir(key_prefix);
	if (res.contents.length === 0 && res.prefixes.length === 0) {
		throw new NodeNotFoundError(path);
	}
	return new ImplicitGroup({ store: h.store, owner: h, path });
}

export async function get_implicit_group<
	Store extends ExtendedReadable | Async<ExtendedReadable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	group: ImplicitGroup<Store, NodePath>,
	path: Path,
): Promise<ImplicitGroup<Store, Deref<Path, NodePath>>>;

export async function get_implicit_group<
	Store extends ExtendedReadable | Async<ExtendedReadable>,
	Path extends AbsolutePath,
>(hierarchy: Hierarchy<Store>, path: Path): Promise<ImplicitGroup<Store, Path>>;

export async function get_implicit_group<
	Store extends ExtendedReadable | Async<ExtendedReadable>,
>(hierarchy: Hierarchy<Store>): Promise<ImplicitGroup<Store, "/">>;

/** @category Getters */
export async function get_implicit_group<
	Store extends ExtendedReadable | Async<ExtendedReadable>,
>(node: ImplicitGroup<Store> | Hierarchy<Store>, _path: any = "/") {
	const { hierarchy, path } = deref(node as Hierarchy<Store>, _path as AbsolutePath);
	return _get_implicit_group(hierarchy as Hierarchy<Store>, path);
}

export async function get<
	Store extends Readable | Async<Readable> | ExtendedReadable | Async<ExtendedReadable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(group: ImplicitGroup<Store, NodePath>, path: Path): Promise<
	| Array<DataType, Store, Deref<Path, NodePath>>
	| ExplicitGroup<Store, Deref<Path, NodePath>>
	| ImplicitGroup<Store, Deref<Path, NodePath>>
>;

export async function get<
	Store extends Readable | Async<Readable> | ExtendedReadable | Async<ExtendedReadable>,
	Path extends AbsolutePath,
>(hierarchy: Hierarchy<Store>, path: Path): Promise<
	| Array<DataType, Store, Path>
	| ExplicitGroup<Store, Path>
	| ImplicitGroup<Store, Path>
>;

export async function get<
	Store extends Readable | Async<Readable> | ExtendedReadable | Async<ExtendedReadable>,
>(hierarchy: Hierarchy<Store>): Promise<
	| Array<DataType, Store, "/">
	| ExplicitGroup<Store, "/">
	| ImplicitGroup<Store, "/">
>;

/** @category Getters */
export async function get<
	Store extends Readable | Async<Readable> | ExtendedReadable | Async<ExtendedReadable>,
>(node: Hierarchy<Store> | ImplicitGroup<Store>, _path: any = "/") {
	const { hierarchy, path } = deref(node as Hierarchy<Store>, _path);
	// try array
	try {
		return await _get_array(hierarchy, path);
	} catch (err) {
		if (!(err instanceof NodeNotFoundError)) {
			throw err;
		}
	}
	// try explicit group
	try {
		return await _get_group(hierarchy, path);
	} catch (err) {
		if (!(err instanceof NodeNotFoundError)) {
			throw err;
		}
	}

	// try implicit group only if ExtendedReadable
	if ("list_dir" in hierarchy.store) {
		try {
			return await get_implicit_group(hierarchy as Hierarchy<ExtendedReadable>, path);
		} catch (err) {
			if (!(err instanceof NodeNotFoundError)) {
				throw err;
			}
		}
	}
	throw new KeyError(path);
}

export function has<
	Store extends Readable | Async<Readable> | ExtendedReadable | Async<ExtendedReadable>,
>(node: Hierarchy<Store> | ImplicitGroup<Store>, _path: any = "/") {
	return get(node as Hierarchy<Store>, _path)
		.then(() => true)
		.catch((err) => {
			if (err instanceof KeyError) return false;
			throw err;
		});
}

/** @category Getters */
export async function get_nodes(
	h: Hierarchy<ExtendedReadable | Async<ExtendedReadable>>,
) {
	const nodes: Map<string, string> = new Map();
	const result = await h.store.list_prefix("/meta/");
	const lookup = (key: string) => {
		if (key.endsWith(h.array_suffix)) {
			return { suffix: h.array_suffix, type: "array" };
		} else if (key.endsWith(h.group_suffix)) {
			return { suffix: h.group_suffix, type: "explicit_group" };
		}
	};

	for (const key of result) {
		if (key === "root.array" + h.meta_key_suffix) {
			nodes.set("/", "array");
		} else if (key == "root.group") {
			nodes.set("/", "explicit_group");
		} else if (key.startsWith("root/")) {
			const m = lookup(key);
			if (m) {
				const path = key.slice("root".length, -m.suffix.length);
				nodes.set(path, m.type);
				const segments = path.split("/");
				segments.pop();
				while (segments.length > 1) {
					const parent = segments.join("/");
					nodes.set(
						parent,
						nodes.get(parent) || "implicit_group",
					);
					segments.pop();
				}
				nodes.set("/", nodes.get("/") || "implicit_group");
			}
		}
	}
	return nodes;
}

async function _get_children(
	h: Hierarchy<ExtendedReadable | Async<ExtendedReadable>>,
	path: AbsolutePath = "/",
) {
	const children: Map<string, string> = new Map();

	// attempt to list directory
	const key_prefix = path === "/" ? "/meta/root/" : `/meta/root${path}/` as const;
	const result = await h.store.list_dir(key_prefix);

	// find explicit children
	for (const n of result.contents) {
		if (n.endsWith(h.array_suffix)) {
			const name = n.slice(0, -h.array_suffix.length);
			children.set(name, "array");
		} else if (n.endsWith(h.group_suffix)) {
			const name = n.slice(0, -h.group_suffix.length);
			children.set(name, "explicit_group");
		}
	}

	// find implicit children
	for (const name of result.prefixes) {
		children.set(name, children.get(name) || "implicit_group");
	}

	return children;
}

export async function get_children(
	group: ImplicitGroup<ExtendedReadable | Async<ExtendedReadable>>,
	path?: string,
): Promise<Map<string, string>>;

export async function get_children(
	hierarchy: Hierarchy<ExtendedReadable | Async<ExtendedReadable>>,
	path?: AbsolutePath,
): Promise<Map<string, string>>;

/** @category Getters */
export async function get_children<
	Store extends ExtendedReadable | Async<ExtendedReadable>,
>(
	node: Hierarchy<Store> | ImplicitGroup<Store>,
	_path?: any,
): Promise<Map<string, string>> {
	if (!_path) {
		// use root if hierarchy, get children for current node if Group
		_path = node instanceof Hierarchy ? "/" : node.path;
	}
	const { hierarchy, path } = deref(node as Hierarchy<Store>, _path);
	return _get_children(hierarchy, path);
}
