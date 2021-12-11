import { ExplicitGroup, ZarrArray } from "./lib/hierarchy";
import { registry } from "./lib/codec-registry";
import { assert, KeyError, NodeNotFoundError } from "./lib/errors";
// deno-fmt-ignore
import { json_decode_object, json_encode_object } from "./lib/util";

import type {
	AbsolutePath,
	Attrs,
	ChunkKey,
	CreateArrayProps,
	DataType,
	Hierarchy as _Hierarchy,
	ReadableStore,
	Store,
	WriteableStore,
} from "./types";
import type { Codec } from "numcodecs";

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

const get_attrs = async (store: ReadableStore, path: AbsolutePath): Promise<Attrs> => {
	const attrs = await store.get(attrs_key(path));
	return attrs ? json_decode_object(attrs) : {};
};

async function create_group<
	S extends Store,
	H extends Hierarchy<S>,
	Path extends AbsolutePath,
>(owner: H, path: Path, attrs?: Attrs) {
	const meta_doc = json_encode_object({ zarr_format: 2 } as GroupMetadata);
	const meta_key = group_meta_key(path);

	await owner.store.set(meta_key, meta_doc);

	if (attrs) {
		await owner.store.set(
			attrs_key(path),
			json_encode_object(attrs),
		);
	}

	return new ExplicitGroup({ store: owner.store, owner, path, attrs: attrs ?? {} });
}

async function create_array<
	S extends Store,
	Path extends AbsolutePath,
	D extends DataType,
>(
	store: S,
	path: Path,
	props: CreateArrayProps<D>,
) {
	const shape = props.shape;
	const dtype = props.dtype;
	const chunk_shape = props.chunk_shape;
	const compressor = props.compressor;
	const chunk_separator = props.chunk_separator ?? ".";

	const meta: ArrayMetadata<D> = {
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

	return new ZarrArray({
		store,
		path,
		shape: meta.shape,
		dtype: dtype,
		chunk_shape: meta.chunks,
		chunk_key: chunk_key(path, chunk_separator),
		compressor: compressor,
		fill_value: meta.fill_value,
		attrs: props.attrs ?? {},
	});
}

function chunk_key(path: AbsolutePath, chunk_separator: "." | "/"): ChunkKey {
	const prefix = key_prefix(path);
	return (chunk_coords) => {
		const chunk_identifier = chunk_coords.join(chunk_separator);
		return `${prefix}${chunk_identifier}`;
	};
}

export const create_hierarchy = <S extends Store>(store: S) => new Hierarchy({ store });

export const get_hierarchy = <S extends Store>(store: S) => new Hierarchy({ store });

export const from_meta = async <
	P extends AbsolutePath,
	S extends Store | ReadableStore,
	D extends DataType,
>(
	store: S,
	path: P,
	meta: ArrayMetadata<D>,
	attrs?: Record<string, any>,
) => {
	return new ZarrArray({
		store: store,
		path,
		shape: meta.shape,
		dtype: meta.dtype,
		chunk_shape: meta.chunks,
		chunk_key: chunk_key(path, meta.dimension_separator ?? "."),
		compressor: await get_codec(meta.compressor),
		fill_value: meta.fill_value,
		attrs: attrs ?? (() => get_attrs(store, path)),
	});
};

export class Hierarchy<S extends Store | ReadableStore> implements _Hierarchy<S> {
	public store: S;
	constructor({ store }: { store: S }) {
		this.store = store;
	}

	get root() {
		return this.get("/");
	}

	create_group<Path extends AbsolutePath>(
		path: Path,
		props: { attrs?: Attrs } = {},
	): S extends WriteableStore ? Promise<ExplicitGroup<S, Hierarchy<S>, Path>> : never {
		assert("set" in this.store, "Not a writeable store");
		return create_group(this as Hierarchy<Store>, path, props.attrs) as any;
	}

	create_array<Path extends AbsolutePath, D extends DataType>(
		path: Path,
		props: CreateArrayProps<D>,
	): S extends WriteableStore ? Promise<ZarrArray<D, S, Path>> : never {
		assert("set" in this.store, "Not a writeable store");
		return create_array(this.store as Store, path, props) as any;
	}

	async get_array<Path extends AbsolutePath>(
		path: Path,
	): Promise<ZarrArray<DataType, S, Path>> {
		// path = normalize_path(path);
		const meta_key = array_meta_key(path);
		const meta_doc = await this.store.get(meta_key);

		if (!meta_doc) {
			throw new NodeNotFoundError(path);
		}

		const meta: ArrayMetadata<DataType> = json_decode_object(meta_doc);

		return from_meta(this.store, path, meta);
	}

	async get_group<Path extends AbsolutePath>(
		path: Path,
	): Promise<ExplicitGroup<S, Hierarchy<S>, Path>> {
		// path = normalize_path(path);

		const meta_key = group_meta_key(path);
		const meta_doc = await this.store.get(meta_key);

		if (!meta_doc) {
			throw new NodeNotFoundError(path);
		}

		// instantiate explicit group
		return new ExplicitGroup({
			store: this.store,
			owner: this,
			path,
			attrs: () => get_attrs(this.store, path),
		});
	}

	async get<Path extends AbsolutePath>(path: Path): Promise<
		ZarrArray<DataType, S, Path> | ExplicitGroup<S, Hierarchy<S>, Path>
	> {
		try {
			return await this.get_array(path);
		} catch (err) {
			if (!(err instanceof NodeNotFoundError)) {
				throw err;
			}
		}
		// try explicit group
		try {
			return await this.get_group(path);
		} catch (err) {
			if (!(err instanceof NodeNotFoundError)) {
				throw err;
			}
		}
		throw new KeyError(path);
	}

	async has(path: AbsolutePath): Promise<boolean> {
		try {
			await this.get(path);
			return true;
		} catch (err) {
			if (err instanceof NodeNotFoundError) {
				return false;
			}
			throw err;
		}
	}

	async get_children(_path: AbsolutePath): Promise<Map<string, string>> {
		console.warn("get_children not implemented for v2.");
		return new Map();
	}

	get_implicit_group(_path: AbsolutePath): never {
		throw new Error("Implicit group not implemented for v2.");
	}
}
