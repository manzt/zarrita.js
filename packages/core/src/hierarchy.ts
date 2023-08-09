import type {
	AbsolutePath,
	Async,
	Readable,
	Writeable,
} from "@zarrita/storage";
import { create_codec_pipeline } from "./codec-registry.js";
import {
	encode_chunk_key,
	json_decode_object,
	json_encode_object,
} from "./util.js";
import {
	type ArrayMetadata,
	type Attributes,
	type CodecMetadata,
	type DataType,
	type GroupMetadata,
	type Scalar,
	v2_marker,
	v2_to_v3_array_metadata,
	v2_to_v3_group_metadata,
} from "./metadata.js";
import { KeyError, NodeNotFoundError } from "./errors.js";
import type * as typesJs from "./types.js";

export class Location<Store> {
	constructor(
		public readonly store: Store,
		public readonly path: AbsolutePath = "/",
	) {}

	resolve(path: string): Location<Store> {
		// reuse URL resolution logic built into the browser
		// handles relative paths, absolute paths, etc.
		let root = new URL(
			`file://${this.path.endsWith("/") ? this.path : `${this.path}/`}`,
		);
		return new Location(
			this.store,
			new URL(path, root).pathname as AbsolutePath,
		);
	}
}

export class Group<
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
> extends Location<Store> {
	#metadata: GroupMetadata;
	#attributes: Record<string, any> | undefined;

	constructor(
		store: Store,
		path: AbsolutePath,
		metadata: GroupMetadata,
	) {
		super(store, path);
		this.#metadata = metadata;
	}

	async attrs() {
		if (
			this.#attributes === undefined &&
			v2_marker in this.#metadata.attributes
		) {
			let maybe_bytes = await this.store.get(this.resolve(`.zattrs`).path);
			this.#attributes = (maybe_bytes && json_decode_object(maybe_bytes)) || {};
		}
		return this.#attributes;
	}
}

export class Array<
	Dtype extends DataType,
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
> extends Location<Store> {
	codec_pipeline: CodecPipeline;
	#metadata: ArrayMetadata<Dtype>;
	#attributes: Record<string, any> | undefined;

	constructor(
		store: Store,
		path: AbsolutePath,
		metadata: ArrayMetadata<Dtype>,
	) {
		super(store, path);
		this.codec_pipeline = create_codec_pipeline(metadata);
		this.#metadata = metadata;
		if (typeof metadata.attributes === "object") {
			this.#attributes = metadata.attributes;
		}
	}

	chunk_key(chunk_coords: number[]): string {
		return encode_chunk_key(
			chunk_coords,
			this.#metadata.chunk_key_encoding,
		);
	}

	async get_chunk(
		chunk_coords: number[],
		options?: Parameters<Store["get"]>[1],
	): Promise<typesJs.Chunk<Dtype>> {
		let chunk_path = this.resolve(this.chunk_key(chunk_coords)).path;
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
		if (
			this.#attributes === undefined &&
			v2_marker in this.#metadata.attributes
		) {
			let attrs = await this.store.get(this.resolve(".zattrs").path);
			this.#attributes = (attrs && json_decode_object(attrs)) || {};
		}
		return this.#attributes ?? {};
	}
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
	try {
		let node = await open_v3(loc);
		if (options.kind === "auto") return node;
		if (options.kind === "array" && node instanceof Array) return node;
		if (options.kind === "group" && node instanceof Group) return node;
	} catch (err) {
		if (err instanceof NodeNotFoundError) {
			return open_v2(loc, options);
		}
		throw err;
	}
}

open.v2 = open_v2;
open.v3 = open_v3;

async function open_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store> | Store,
	options: { kind: "auto" | "array" | "group" } = { kind: "auto" },
) {
	let loc = "store" in location ? location : new Location(location);
	if (options.kind === "array") return open_array_v2(loc);
	if (options.kind === "group") return open_group_v2(loc);
	return open_array_v2(loc).catch(() => open_group_v2(loc));
}

async function open_array_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store>,
) {
	let { path } = location.resolve(".zarray");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	return new Array(
		location.store,
		location.path,
		v2_to_v3_array_metadata(json_decode_object(meta)),
	);
}

async function open_group_v2<Store extends Readable | Async<Readable>>(
	location: Location<Store>,
) {
	let { path } = location.resolve(".zgroup");
	let meta = await location.store.get(path);
	if (!meta) {
		throw new NodeNotFoundError(path);
	}
	return new Group(
		location.store,
		location.path,
		v2_to_v3_group_metadata(json_decode_object(meta)),
	);
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
		? new Array(store, location.path, meta_doc)
		: new Group(store, location.path, meta_doc);
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
	attributes?: Attributes;
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
	await location.store.set(
		location.resolve("zarr.json").path,
		json_encode_object(metadata),
	);
	return new Group(location.store, location.path, metadata);
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
	await location.store.set(
		location.resolve("zarr.json").path,
		json_encode_object(metadata),
	);
	return new Array(location.store, location.path, metadata);
}
