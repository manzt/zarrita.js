import { ExplicitGroup, ZarrArray } from "./lib/hierarchy";
import { registry } from "./lib/codec-registry";
import { assert, KeyError, NodeNotFoundError } from "./lib/errors";
// deno-fmt-ignore
import { json_decode_object, json_encode_object } from "./lib/util";

import type {
	AbsolutePath,
	Async,
	Attrs,
	ChunkKey,
	CreateArrayProps,
	DataType,
	Hierarchy as _Hierarchy,
	Readable,
	Writeable,
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

const get_attrs = async (
	store: Readable | Async<Readable>,
	path: AbsolutePath,
): Promise<Attrs> => {
	const attrs = await store.get(attrs_key(path));
	return attrs ? json_decode_object(attrs) : {};
};

function chunk_key(path: AbsolutePath, chunk_separator: "." | "/"): ChunkKey {
	const prefix = key_prefix(path);
	return (chunk_coords) => {
		const chunk_identifier = chunk_coords.join(chunk_separator);
		return `${prefix}${chunk_identifier}`;
	};
}

export const create_hierarchy = <
	S extends Readable & Writeable | Async<Readable & Writeable>,
>(store: S) => new Hierarchy({ store });

export const get_hierarchy = <S extends Readable | Async<Readable>>(store: S) =>
	new Hierarchy({ store });

export const from_meta = async <
	P extends AbsolutePath,
	S extends Readable | Async<Readable>,
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

export class Hierarchy<Store extends Readable | Async<Readable>>
	implements _Hierarchy<Store> {
	public store: Store;
	constructor({ store }: { store: Store }) {
		this.store = store;
	}

	get root() {
		return this.get("/");
	}

	async create_group<Path extends AbsolutePath>(
		path: Path,
		{ attrs }: { attrs?: Attrs } = {},
	): Promise<
		Store extends (Writeable | Async<Writeable>)
			? ExplicitGroup<Store, Hierarchy<Store>, Path>
			: never
	> {
		assert("set" in this.store, "Not a writeable store");
		const meta_doc = json_encode_object({ zarr_format: 2 } as GroupMetadata);
		const meta_key = group_meta_key(path);

		await (this.store as any as Writeable | Async<Writeable>).set(meta_key, meta_doc);

		if (attrs) {
			await (this.store as any as Writeable | Async<Writeable>).set(
				attrs_key(path),
				json_encode_object(attrs),
			);
		}

		return new ExplicitGroup({
			store: this.store,
			owner: this,
			path,
			attrs: attrs ?? {},
		}) as any;
	}

	async create_array<Path extends AbsolutePath, Dtype extends DataType>(
		path: Path,
		props: CreateArrayProps<Dtype>,
	): Promise<
		Store extends (Writeable | Async<Writeable>) ? ZarrArray<Dtype, Store, Path>
			: never
	> {
		assert("set" in this.store, "Not a writeable store");
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

		await (this.store as any as Writeable | Async<Writeable>).set(meta_key, meta_doc);

		if (props.attrs) {
			await (this.store as any as Writeable | Async<Writeable>).set(
				attrs_key(path),
				json_encode_object(props.attrs),
			);
		}

		return new ZarrArray({
			store: this.store,
			path,
			shape: meta.shape,
			dtype: dtype,
			chunk_shape: meta.chunks,
			chunk_key: chunk_key(path, chunk_separator),
			compressor: compressor,
			fill_value: meta.fill_value,
			attrs: props.attrs ?? {},
		}) as any;
	}

	async get_array<Path extends AbsolutePath>(
		path: Path,
	): Promise<ZarrArray<DataType, Store, Path>> {
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
	): Promise<ExplicitGroup<Store, Hierarchy<Store>, Path>> {
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
		ZarrArray<DataType, Store, Path> | ExplicitGroup<Store, Hierarchy<Store>, Path>
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

	get_children(_path: AbsolutePath): never {
		throw new Error("get_children not implemented for v2.");
	}

	get_implicit_group(_path: AbsolutePath): never {
		throw new Error("Implicit group not implemented for v2.");
	}
}
