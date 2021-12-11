import { ExplicitGroup, ImplicitGroup, ZarrArray } from "./lib/hierarchy";
import { registry } from "./lib/codec-registry";
import { assert, KeyError, NodeNotFoundError, NotImplementedError } from "./lib/errors";
// deno-fmt-ignore
import { json_decode_object, json_encode_object } from "./lib/util";

import type {
	AbsolutePath,
	Attrs,
	CreateArrayProps,
	DataType,
	Hierarchy as _Hierarchy,
	ReadableStore,
	Scalar,
	Store,
	WriteableStore,
} from "./types";
import type { Codec } from "numcodecs";

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
	chunk_memory_layout: "C";
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

async function create_group<
	S extends Store,
	H extends Hierarchy<S>,
	Path extends AbsolutePath,
>(owner: H, path: Path, attrs: Attrs = {}) {
	const meta: GroupMetadata = { extensions: [], attributes: attrs };

	// serialise and store metadata document
	const meta_doc = json_encode_object(meta);
	const key = meta_key(path, owner.meta_key_suffix, "group");
	await owner.store.set(key, meta_doc);
	return new ExplicitGroup({ store: owner.store, owner, path, attrs });
}

async function create_array<
	S extends Store,
	H extends Hierarchy<S>,
	Path extends AbsolutePath,
	D extends DataType,
>(
	owner: H,
	path: Path,
	props: Omit<CreateArrayProps<D>, "filters">,
): Promise<ZarrArray<D, S, Path>> {
	const shape = props.shape;
	const dtype = props.dtype;
	const chunk_shape = props.chunk_shape;
	const compressor = props.compressor;

	const meta: ArrayMetadata<D> = {
		shape,
		data_type: dtype,
		chunk_grid: {
			type: "regular",
			separator: props.chunk_separator ?? "/",
			chunk_shape,
		},
		chunk_memory_layout: "C",
		fill_value: props.fill_value ?? null,
		extensions: [],
		attributes: props.attrs ?? {},
	};

	if (compressor) {
		meta.compressor = encode_codec_metadata(compressor);
	}

	// serialise and store metadata document
	const meta_doc = json_encode_object(meta);
	const key = meta_key(path, owner.meta_key_suffix, "array");
	await owner.store.set(key, meta_doc);

	return new ZarrArray({
		store: owner.store,
		path,
		shape: meta.shape,
		dtype: dtype,
		chunk_shape: meta.chunk_grid.chunk_shape,
		chunk_key: chunk_key(path, meta.chunk_grid.separator),
		compressor: compressor,
		fill_value: meta.fill_value,
		attrs: meta.attributes,
	});
}

const chunk_key = (path: string, chunk_separator: "." | "/") =>
	(chunk_coords: number[]): AbsolutePath => {
		const chunk_identifier = "c" + chunk_coords.join(chunk_separator);
		return `/data/root${path}/${chunk_identifier}`;
	};

export async function create_hierarchy<S extends Store>(
	store: S,
): Promise<Hierarchy<S>> {
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

export async function get_hierarchy<S extends Store | ReadableStore>(
	store: S,
): Promise<Hierarchy<S>> {
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

export class Hierarchy<S extends Store | ReadableStore> implements _Hierarchy<S> {
	store: S;
	meta_key_suffix: string;

	constructor({ store, meta_key_suffix }: { store: S; meta_key_suffix: string }) {
		this.store = store;
		this.meta_key_suffix = meta_key_suffix;
	}

	get root() {
		return this.get("/");
	}

	get array_suffix() {
		return ".array" + this.meta_key_suffix;
	}

	get group_suffix() {
		return ".group" + this.meta_key_suffix;
	}

	create_group<Path extends AbsolutePath>(
		path: Path,
		props: { attrs?: Attrs } = {},
	): S extends WriteableStore ? Promise<ExplicitGroup<S, Hierarchy<S>, Path>> : never {
		assert("set" in this.store, "Not a writable store");
		return create_group(this as Hierarchy<Store>, path, props.attrs) as any;
	}

	create_array<Path extends AbsolutePath, D extends DataType>(
		path: Path,
		props: Omit<CreateArrayProps<D>, "filters">,
	): S extends WriteableStore ? Promise<ZarrArray<D, S, Path>> : never {
		assert("set" in this.store, "Not a writable store");
		return create_array(this as Hierarchy<Store>, path, props) as any;
	}

	async get_array<Path extends AbsolutePath>(
		path: Path,
	): Promise<ZarrArray<DataType, S, Path>> {
		const key = meta_key(path, this.meta_key_suffix, "array");
		const meta_doc = await this.store.get(key);

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

		if (chunk_memory_layout !== "C") {
			throw new NotImplementedError(
				`Only support for "C" order chunk_memory_layout, got ${chunk_memory_layout}.`,
			);
		}

		for (const spec of extensions) {
			if (spec.must_understand) {
				throw new NotImplementedError(
					`No support for required extensions found, ${JSON.stringify(spec)}.`,
				);
			}
		}

		return new ZarrArray({
			store: this.store,
			path,
			shape: shape,
			dtype: dtype,
			chunk_shape: chunk_grid.chunk_shape,
			chunk_key: chunk_key(path, chunk_grid.separator),
			compressor: meta.compressor
				? await decode_codec_metadata(meta.compressor)
				: undefined,
			fill_value,
			attrs,
		});
	}

	async get_group<Path extends AbsolutePath>(
		path: Path,
	): Promise<ExplicitGroup<S, Hierarchy<S>, Path>> {
		// retrieve and parse group metadata document
		const key = meta_key(path, this.meta_key_suffix, "group");
		const meta_doc = await this.store.get(key);

		if (!meta_doc) {
			throw new NodeNotFoundError(path);
		}

		const meta: GroupMetadata = json_decode_object(meta_doc);

		// instantiate explicit group
		return new ExplicitGroup({
			store: this.store,
			owner: this,
			path,
			attrs: meta.attributes,
		});
	}

	async get_implicit_group<Path extends AbsolutePath>(
		path: Path,
	): Promise<ImplicitGroup<S, Hierarchy<S>, Path>> {
		let contents: string[] = [];
		let prefixes: string[] = [];
		if ("list_dir" in this.store) {
			// attempt to list directory
			const key_prefix = (path as any) === "/"
				? "/meta/root/"
				: `/meta/root${path}/` as const;

			const result = await this.store.list_dir(key_prefix);
			contents = result.contents;
			prefixes = result.prefixes;
		}

		if (contents.length === 0 && prefixes.length === 0) {
			throw new NodeNotFoundError(path);
		}

		return new ImplicitGroup({ store: this.store, path, owner: this });
	}

	async get<Path extends AbsolutePath>(path: Path): Promise<
		| ZarrArray<DataType, S, Path>
		| ExplicitGroup<S, Hierarchy<S>, Path>
		| ImplicitGroup<S, Hierarchy<S>, Path>
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

		// try implicit group
		try {
			return this.get_implicit_group(path);
		} catch (err) {
			if (!(err instanceof NodeNotFoundError)) {
				throw err;
			}
			throw new KeyError(path);
		}
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

	async get_nodes(): Promise<Map<string, string>> {
		const nodes: Map<string, string> = new Map();
		if (!("list_prefix" in this.store)) {
			return nodes;
		}
		const result = await this.store.list_prefix("/meta/");

		const lookup = (key: string) => {
			if (key.endsWith(this.array_suffix)) {
				return { suffix: this.array_suffix, type: "array" };
			} else if (key.endsWith(this.group_suffix)) {
				return { suffix: this.group_suffix, type: "explicit_group" };
			}
		};

		for (const key of result) {
			if (key === "root.array" + this.meta_key_suffix) {
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

	async get_children(path: AbsolutePath = "/"): Promise<Map<string, string>> {
		const children: Map<string, string> = new Map();

		// attempt to list directory
		const key_prefix = path === "/" ? "/meta/root/" : `/meta/root${path}/` as const;
		const result = await this.store.list_dir(key_prefix);

		// find explicit children
		for (const n of result.contents) {
			if (n.endsWith(this.array_suffix)) {
				const name = n.slice(0, -this.array_suffix.length);
				children.set(name, "array");
			} else if (n.endsWith(this.group_suffix)) {
				const name = n.slice(0, -this.group_suffix.length);
				children.set(name, "explicit_group");
			}
		}

		// find implicit children
		for (const name of result.prefixes) {
			children.set(name, children.get(name) || "implicit_group");
		}

		return children;
	}
}
