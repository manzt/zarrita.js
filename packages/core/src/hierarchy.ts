import type {
	AbsolutePath,
	Async,
	Readable,
	Writeable,
} from "@zarrita/storage";
import { type CodecPipeline, create_codec_pipeline } from "./codec-registry.js";
import {
	encode_chunk_key,
	json_decode_object,
	json_encode_object,
} from "./util.js";
import type {
	ArrayMetadata,
	Chunk,
	CodecMetadata,
	DataType,
	GroupMetadata,
	Scalar,
} from "./types.js";
import { KeyError, NodeNotFoundError } from "./errors.js";

export class Location<Store> {
	constructor(
		public readonly store: Store,
		public readonly path: AbsolutePath = "/",
		public version: "2" | "3" = "3",
	) {}

	resolve(path: string): Location<Store> {
		if (path[0] !== "/") {
			// treat as relative path
			if ((this.path as any) === "/") {
				// special case root group
				path = `/${path}` as any;
			} else {
				path = `${this.path}/${path}` as any;
			}
		}
		return new Location(this.store, path as AbsolutePath, this.version);
	}

	static v2<Store>(
		store: Store,
	) {
		return new Location<Store>(store, "/", "2");
	}
}

type LazyGetter<T, Key extends keyof T> = {
	[K in keyof T]: K extends Key ? T[K] | (() => Promise<T[K]>) : T[K];
};

export class Group<
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
> extends Location<Store> {
	#metadata: LazyGetter<GroupMetadata, "attributes">;
	#attributes: Record<string, any> | undefined;

	constructor(
		store: Store,
		path: AbsolutePath,
		metadata: LazyGetter<GroupMetadata, "attributes">,
	) {
		super(store, path);
		this.#metadata = metadata;
	}

	async attrs() {
		if (!this.#attributes && typeof this.#metadata.attributes === "function") {
			this.#attributes = await this.#metadata.attributes();
		}
		return this.#attributes;
	}
}

export class Array<
	Dtype extends DataType,
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
> extends Location<Store> {
	codec_pipeline: CodecPipeline;
	#metadata: LazyGetter<ArrayMetadata<Dtype>, "attributes">;
	#attributes: Record<string, any> | undefined;

	constructor(
		store: Store,
		path: AbsolutePath,
		metadata: LazyGetter<ArrayMetadata<Dtype>, "attributes">,
	) {
		super(store, path);
		this.codec_pipeline = create_codec_pipeline(metadata);
		this.#metadata = metadata;
		if (typeof metadata.attributes === "object") {
			this.#attributes = metadata.attributes;
		}
	}

	_chunk_path(chunk_coords: number[]): AbsolutePath {
		let chunk_key = encode_chunk_key(
			chunk_coords,
			this.#metadata.chunk_key_encoding,
		);
		return `${this.path}${chunk_key}`;
	}

	async get_chunk(
		chunk_coords: number[],
		options?: Parameters<Store["get"]>[1],
	): Promise<Chunk<Dtype>> {
		let chunk_path = this._chunk_path(chunk_coords);
		let maybe_bytes = await this.store.get(chunk_path, options);
		if (!maybe_bytes) {
			throw new KeyError(chunk_path);
		}
		return this.codec_pipeline.decode(maybe_bytes);
	}

	get shape() {
		return this.#metadata.shape;
	}

	get chunk_shape() {
		return this.#metadata.chunk_grid.configuration.chunk_shape;
	}

	get dtype(): Dtype {
		return this.#metadata.data_type;
	}

	get fill_value(): Scalar<Dtype> | null {
		return this.#metadata.fill_value;
	}

	async attrs() {
		if (!this.#attributes && typeof this.#metadata.attributes === "function") {
			this.#attributes = await this.#metadata.attributes();
		}
		return this.#attributes;
	}
}

const meta_converters = {
	array<Store extends Readable | Async<Readable>>(
		location: Location<Store>,
		meta: ArrayMetadataV2<DataType>,
	): LazyGetter<ArrayMetadata<DataType>, "attributes"> {
		let codecs: CodecMetadata[] = [];
		for (let { id, ...configuration } of meta.filters ?? []) {
			codecs.push({ name: id, configuration });
		}
		if (meta.compressor) {
			let { id, ...configuration } = meta.compressor;
			codecs.push({ name: id, configuration });
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
			attributes: async () => {
				let meta = await location.store.get(location.resolve(".zattrs").path);
				if (!meta) return {};
				return json_decode_object(meta);
			},
		};
	},
	group<Store extends Readable | Async<Readable>>(
		location: Location<Store>,
	): LazyGetter<GroupMetadata, "attributes"> {
		return {
			zarr_format: 3,
			node_type: "group",
			attributes: async () => {
				let meta = await location.store.get(location.resolve(".zattrs").path);
				if (!meta) return {};
				return json_decode_object(meta);
			},
		};
	},
};

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
export interface GroupMetadataV2 {
	zarr_format: 2;
}

export function root<Store>(store: Store) {
	return new Location(store);
}

export function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "group" },
): Promise<Group<Store>>;

export function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "array" },
): Promise<Array<DataType, Store>>;

export function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "auto" },
): Promise<Array<DataType, Store> | Group<Store>>;

export function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
): Promise<Array<DataType, Store> | Group<Store>>;

export async function open<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "auto" | "array" | "group" } = { kind: "auto" },
) {
	let loc = "store" in location ? location : new Location(location);
	if (loc.version === "3") {
		let node = await open_v3(loc);
		if (options.kind === "auto") return node;
		if (options.kind === "array" && node instanceof Array) return node;
		if (options.kind === "group" && node instanceof Group) return node;
		throw new Error(`Expected ${options.kind} but got ${node}`);
	}
	if (options.kind === "array") return open_array_v2(loc);
	if (options.kind === "group") return open_group_v2(loc);
	return open_array_v2(loc).catch(() => open_group_v2(loc));
}

async function open_array_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store>,
) {
	let { store, path } = location.resolve(".zarray");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	let meta_doc: ArrayMetadataV2<any> = json_decode_object(meta);
	return new Array(store, path, meta_converters.array(location, meta_doc));
}

async function open_group_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store>,
) {
	let { store, path } = location.resolve(".zgroup");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	json_decode_object(meta); // just make sure we don't get an error
	return new Group(store, path, meta_converters.group(location));
}

async function open_v3<Store extends Readable | Async<Readable>>(
	location: Location<Store>,
) {
	let { store, path } = location.resolve("zarr.json");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	let meta_doc: ArrayMetadata<DataType> | GroupMetadata = json_decode_object(
		meta,
	);
	return meta_doc.node_type === "array"
		? new Array(store, path, meta_doc)
		: new Group(store, path, meta_doc);
}

export interface CreateGroupOptions {
	attributes?: Record<string, any>;
}

export interface CreateArrayOptions<Dtype extends DataType> {
	shape: number[];
	chunk_shape: number[];
	data_type: Dtype;
	codecs?: CodecMetadata[];
	fill_value?: Scalar<Dtype>;
	chunk_separator?: "." | "/";
	attributes?: Record<string, any>;
}

export async function create<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Dtype extends DataType = DataType,
>(
	location: Location<Store> | Store,
	options: CreateGroupOptions,
): Promise<Group<Store>>;

export async function create<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Dtype extends DataType,
>(
	location: Location<Store> | Store,
	options: CreateArrayOptions<Dtype>,
): Promise<Array<Dtype, Store>>;

export async function create<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Dtype extends DataType,
>(
	location: Location<Store> | Store,
	options: CreateArrayOptions<Dtype> | CreateGroupOptions,
): Promise<Array<Dtype, Store> | Group<Store>> {
	let loc = "store" in location ? location : new Location(location);
	if (loc.version !== "3") {
		throw new Error("Only Zarr v3 is supported");
	}
	if ("shape" in options) return create_array(loc, options) as any;
	return create_group(loc, options);
}

async function create_group<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
>(
	location: Location<Store>,
	options: CreateGroupOptions = {},
): Promise<Group<Store>> {
	let metadata = {
		zarr_format: 3,
		node_type: "group",
		attributes: options.attributes ?? {},
	} satisfies GroupMetadata;
	let { store, path } = location.resolve("zarr.json");
	await store.set(path, json_encode_object(metadata));
	return new Group(store, path, metadata);
}

async function create_array<
	Store extends (Readable & Writeable) | Async<Readable & Writeable>,
	Dtype extends DataType,
>(
	location: Location<Store>,
	options: CreateArrayOptions<Dtype>,
): Promise<Array<DataType, Store>> {
	let metadata = {
		zarr_format: 3,
		node_type: "array",
		shape: options.shape,
		data_type: options.data_type,
		chunk_grid: {
			name: "regular",
			configuration: {
				chunk_shape: options.chunk_shape,
			},
		},
		chunk_key_encoding: {
			name: "default",
			configuration: {
				separator: options.chunk_separator ?? "/",
			},
		},
		codecs: options.codecs ?? [],
		fill_value: options.fill_value ?? null,
		attributes: options.attributes ?? {},
	} satisfies ArrayMetadata<Dtype>;
	let { store, path } = location.resolve("zarr.json");
	await store.set(path, json_encode_object(metadata));
	return new Array(store, path, metadata);
}
