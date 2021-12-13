import { Array as BaseArray, ArrayProps, Group as BaseGroup } from "./lib/hierarchy";
import { registry } from "./lib/codec-registry";
import { KeyError, NodeNotFoundError } from "./lib/errors";
import { json_decode_object, json_encode_object } from "./lib/util";

export { slice } from "./lib/util";
export { registry } from "./lib/codec-registry";
export { BoolArray, ByteStringArray, UnicodeStringArray } from "./lib/custom-arrays";

import type {
	AbsolutePath,
	Async,
	Attrs,
	CreateArrayProps,
	DataType,
	Deref,
	Readable,
	Writeable,
} from "./types";

import type { Codec } from "numcodecs";

async function get_attrs<Store extends Readable | Async<Readable>>(
	store: Store,
	path: AbsolutePath,
) {
	const maybe_bytes = await store.get(attrs_key(path));
	const attrs: Attrs = maybe_bytes ? json_decode_object(maybe_bytes) : {};
	return attrs;
}

export class Array<
	Dtype extends DataType,
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath = AbsolutePath,
> extends BaseArray<Dtype, Store, Path> {
	private _attrs?: Attrs;

	constructor(props: ArrayProps<Dtype, Store, Path> & { attrs?: Attrs }) {
		super(props);
		this._attrs = props.attrs;
	}
	_chunk_key(chunk_coords: number[]) {
		const prefix = key_prefix(this.path);
		const chunk_identifier = chunk_coords.join(this.chunk_separator);
		return `${prefix}${chunk_identifier}` as AbsolutePath;
	}

	async attrs() {
		if (this._attrs) return this._attrs;
		const attrs = (this._attrs = get_attrs(this.store, this.path));
		return attrs;
	}
}

export class Group<
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath = AbsolutePath,
> extends BaseGroup<Store, Path> {
	private _attrs?: Attrs;

	constructor(props: { store: Store; path: Path; attrs?: Attrs }) {
		super(props);
		this._attrs = props.attrs;
	}

	async attrs() {
		if (this._attrs) return this._attrs;
		const attrs = (this._attrs = get_attrs(this.store, this.path));
		return attrs;
	}
}

function encode_codec_metadata(codec: Codec) {
	// @ts-ignore
	return { id: codec.constructor.codecId, ...codec };
}

async function get_codec(
	config: Record<string, any> | null | undefined,
): Promise<Codec | undefined> {
	if (!config) return;
	const importer = registry.get(config.id);
	if (!importer) throw new Error("missing codec" + config.id);
	const ctr = await importer();
	return ctr.fromConfig(config);
}

interface ArrayMetadata<Dtype extends DataType> {
	zarr_format: 2;
	shape: number[];
	chunks: number[];
	dtype: Dtype;
	compressor: null | Record<string, any>;
	fill_value: import("./types").Scalar<Dtype> | null;
	order: "C" | "F";
	filters: null | Record<string, any>[];
	dimension_separator?: "." | "/";
}

interface GroupMetadata {
	zarr_format: 2;
}

function key_prefix<Path extends AbsolutePath>(
	path: Path,
): Path extends "/" ? "/" : `${Path}/` {
	// @ts-ignore
	return path === "/" ? path : `${path}/`;
}

const array_meta_key = (path: AbsolutePath) => `${key_prefix(path)}.zarray` as const;

const group_meta_key = (path: AbsolutePath) => `${key_prefix(path)}.zgroup` as const;

const attrs_key = (path: AbsolutePath) => `${key_prefix(path)}.zattrs` as const;

export async function from_meta<
	P extends AbsolutePath,
	S extends Readable | Async<Readable>,
	D extends DataType,
>(
	store: S,
	path: P,
	meta: ArrayMetadata<D>,
	attrs?: Record<string, any>,
) {
	return new Array({
		store: store,
		path,
		shape: meta.shape,
		dtype: meta.dtype,
		chunk_shape: meta.chunks,
		chunk_separator: meta.dimension_separator ?? ".",
		compressor: await get_codec(meta.compressor),
		fill_value: meta.fill_value,
		attrs: attrs,
	});
}

function deref<
	Store extends Readable | Async<Readable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(grp: Group<Store, NodePath>, path: Path): { store: Store; path: Deref<Path, NodePath> };

function deref<Store, Path extends AbsolutePath>(
	store: Store,
	path: Path,
): { store: Store; path: Path };

function deref<Store extends Readable | Async<Readable>>(
	node: Store | Group<Store>,
	path: any,
) {
	if ("store" in node) {
		return { store: node.store, path: node.deref(path) };
	}
	return { store: node, path };
}

async function _get_array<
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath,
>(store: Store, path: Path) {
	const meta_key = array_meta_key(path);
	const meta_doc = await store.get(meta_key);
	if (!meta_doc) {
		throw new NodeNotFoundError(path);
	}
	const meta: ArrayMetadata<DataType> = json_decode_object(meta_doc);
	return from_meta(store, path, meta);
}

export function get_array<
	Store extends Readable | Async<Readable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	group: Group<Store, NodePath>,
	path: Path,
): Promise<Array<DataType, Store, Deref<Path, NodePath>>>;

export function get_array<
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath,
>(store: Store, path: Path): Promise<Array<DataType, Store, Path>>;

export function get_array<
	Store extends Readable | Async<Readable>,
>(store: Store): Promise<Array<DataType, Store, "/">>;

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
	return new Group({ store, path });
}

export function get_group<
	Store extends Readable | Async<Readable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	group: Group<Store, NodePath>,
	path: Path,
): Promise<Group<Store, Deref<Path, NodePath>>>;

export function get_group<
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath,
>(store: Store, path: Path): Promise<Group<Store, Path>>;

export function get_group<
	Store extends Readable | Async<Readable>,
>(store: Store): Promise<Group<Store, "/">>;

export async function get_group<
	Store extends Readable | Async<Readable>,
>(node: Store | Group<Store>, _path: any = "/") {
	const { store, path } = deref(node, _path);
	return _get_group(store as Store, path as AbsolutePath);
}

export function get<
	Store extends Readable | Async<Readable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	group: Group<Store, NodePath>,
	path: Path,
): Promise<
	Array<DataType, Store, Deref<Path, NodePath>> | Group<Store, Deref<Path, NodePath>>
>;

export function get<
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath,
>(store: Store, path: Path): Promise<Array<DataType, Store, Path> | Group<Store, Path>>;

export function get<
	Store extends Readable | Async<Readable>,
>(store: Store): Promise<Array<DataType, Store, "/"> | Group<Store, "/">>;

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
	attrs: Attrs = {},
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
	return new Group({ store, path, attrs: attrs ?? {} });
}

export function create_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends string,
	NodePath extends AbsolutePath,
>(
	group: Group<Store, NodePath>,
	path: Path,
	props?: { attrs?: Attrs },
): Promise<Group<Store, Deref<Path, NodePath>>>;

export function create_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends AbsolutePath,
>(store: Store, path: Path, props?: { attrs?: Attrs }): Promise<Group<Store, Path>>;

export async function create_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
>(node: Store | Group<Store>, _path: any, props: { attrs?: Attrs } = {}) {
	const { store, path } = deref(node, _path);
	return _create_group(store as Store, path as AbsolutePath, props.attrs);
}

async function _create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends AbsolutePath,
	Dtype extends DataType,
>(
	store: Store,
	path: Path,
	props: CreateArrayProps<Dtype>,
) {
	const shape = props.shape;
	const dtype = props.dtype;
	const chunk_shape = props.chunk_shape;
	const compressor = props.compressor;
	const chunk_separator = props.chunk_separator ?? ".";

	const meta: ArrayMetadata<Dtype> = {
		zarr_format: 2,
		shape,
		dtype,
		chunks: chunk_shape,
		dimension_separator: chunk_separator,
		order: "C",
		fill_value: props.fill_value ?? null,
		filters: [],
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

	return new Array({
		store: store,
		path: path,
		shape: meta.shape,
		dtype: dtype,
		chunk_shape: meta.chunks,
		chunk_separator: chunk_separator,
		compressor: compressor,
		fill_value: meta.fill_value,
		attrs: props.attrs ?? {},
	});
}

export function create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends string,
	NodePath extends AbsolutePath,
	Dtype extends DataType,
>(
	group: Group<Store, NodePath>,
	path: Path,
	props: CreateArrayProps<Dtype>,
): Promise<Array<Dtype, Store, Deref<Path, NodePath>>>;

export function create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Path extends AbsolutePath,
	Dtype extends DataType,
>(
	store: Store,
	path: Path,
	props: CreateArrayProps<Dtype>,
): Promise<Array<Dtype, Store, Path>>;

export async function create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Dtype extends DataType,
>(node: Store | Group<Store>, _path: any, props: CreateArrayProps<Dtype>) {
	const { store, path } = deref(node, _path);
	return _create_array(store as Store, path as AbsolutePath, props);
}

export function has<Store extends Readable | Async<Readable>>(
	group: Group<Store, AbsolutePath>,
	path: string,
): Promise<boolean>;

export function has<Store extends Readable | Async<Readable>>(
	store: Store,
	path: AbsolutePath,
): Promise<boolean>;

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
