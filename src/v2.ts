import { ExplicitGroup, ZarrArray } from "./lib/hierarchy";
import { registry } from "./lib/codec-registry";
import { KeyError, NodeNotFoundError } from "./lib/errors";
// deno-fmt-ignore
import { ensure_array, ensure_dtype, json_decode_object, json_encode_object } from "./lib/util";

import type {
	Attrs,
	CreateArrayProps,
	DataType,
	Hierarchy as HierarchyProtocol,
	Store,
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

type KeyPrefix<S extends string> = S extends "" ? S : `${S}/`;

function key_prefix<S extends string>(path: S): KeyPrefix<S> {
	return path.length > 1 ? path + "/" : "" as any;
}

function meta_key<S extends string, N extends string>(
	path: S,
	name: N,
): `${KeyPrefix<S>}${N}` {
	return key_prefix(path) + name as any;
}

const array_meta_key = <S extends string>(path: S) => meta_key(path, ".zarray");
const group_meta_key = <S extends string>(path: S) => meta_key(path, ".zgroup");
const attrs_key = <S extends string>(path: S) => meta_key(path, ".zattrs");

const get_attrs = async (store: Store, path: string): Promise<Attrs> => {
	const attrs = await store.get(attrs_key(path));
	return attrs ? json_decode_object(attrs) : {};
};

const chunk_key = (
	path: string,
	chunk_separator: "." | "/",
): ((chunk_coords: number[]) => string) => {
	const prefix = key_prefix(path);
	return (chunk_coords) => {
		const chunk_identifier = chunk_coords.join(chunk_separator);
		const chunk_key = prefix + chunk_identifier;
		return chunk_key;
	};
};

export const create_hierarchy = <S extends Store>(store: S) => new Hierarchy({ store });

export const get_hierarchy = <S extends Store>(store: S) => new Hierarchy({ store });

export const from_meta = async <S extends Store, D extends DataType>(
	store: S,
	path: string,
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

export class Hierarchy<S extends Store> implements HierarchyProtocol<S> {
	public store: S;
	constructor({ store }: { store: S }) {
		this.store = store;
	}

	get root() {
		return this.get("/");
	}

	async create_group(
		path: string,
		props: { attrs?: Attrs } = {},
	): Promise<ExplicitGroup<S, Hierarchy<S>>> {
		const { attrs } = props;
		// sanity checks
		// path = normalize_path(path);

		// serialise and store metadata document
		const meta_doc = json_encode_object({ zarr_format: 2 } as GroupMetadata);
		const meta_key = group_meta_key(path);
		await this.store.set(meta_key, meta_doc);

		if (attrs) {
			await this.store.set(attrs_key(path), json_encode_object(attrs));
		}

		return new ExplicitGroup({
			store: this.store,
			owner: this,
			path,
			attrs: attrs ?? {},
		});
	}

	async create_array<D extends DataType>(
		path: string,
		props: CreateArrayProps<D>,
	): Promise<ZarrArray<D, S>> {
		// sanity checks
		// path = normalize_path(path);
		const shape = ensure_array(props.shape);
		const dtype = ensure_dtype(props.dtype);
		const chunk_shape = ensure_array(props.chunk_shape);
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
		await this.store.set(meta_key, meta_doc);

		if (props.attrs) {
			await this.store.set(
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
		});
	}

	async get_array(path: string): Promise<ZarrArray<DataType, S>> {
		// path = normalize_path(path);
		const meta_key = array_meta_key(path);
		const meta_doc = await this.store.get(meta_key);

		if (!meta_doc) {
			throw new NodeNotFoundError(path);
		}

		const meta: ArrayMetadata<DataType> = json_decode_object(meta_doc);

		return from_meta(this.store, path, meta);
	}

	async get_group(path: string): Promise<ExplicitGroup<S, Hierarchy<S>>> {
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

	async get(path: string): Promise<
		ZarrArray<DataType, S> | ExplicitGroup<S, Hierarchy<S>>
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

	async has(path: string): Promise<boolean> {
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

	async get_children(_path: string): Promise<Map<string, string>> {
		console.warn("get_children not implemented for v2.");
		return new Map();
	}

	get_implicit_group(_path: string): never {
		throw new Error("Implicit group not implemented for v2.");
	}
}
