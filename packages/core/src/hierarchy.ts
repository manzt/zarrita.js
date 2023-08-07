import type { AbsolutePath, Async, Readable } from "@zarrita/storage";

import { registry } from "./codec-registry.js";
import { encode_chunk_key, create_codec_pipeline, type CodecPipeline  } from "./util.js";
import type { DataType, ArrayMetadata, GroupMetadata, Chunk, Scalar } from "./types.js";

function dereference_path(root: AbsolutePath, path: string): AbsolutePath {
	if (path[0] !== "/") {
		// treat as relative path
		if ((root as any) === "/") {
			// special case root group
			path = `/${path}` as any;
		} else {
			path = `${root}/${path}` as any;
		}
	}
	return path as AbsolutePath;
}

export class Locator<Store> {
	constructor(
		public readonly store: Store,
		public readonly path: AbsolutePath = "/",
		public readonly codec_registry: typeof registry = registry,
	) {}

	resolve(path: string, ...parts: string[]): Locator<Store> {
		if (parts.length > 0) {
			path = `${path}/${parts.join("/")}`;
		}
		return new Locator(
			this.store,
			dereference_path(this.path, path),
			this.codec_registry,
		);
	}
}

export class Group<
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
> {
	public readonly store: Store;
	public readonly path: AbsolutePath;
	#metadata: GroupMetadata;

	constructor(store: Store, path: AbsolutePath, metadata: GroupMetadata) {
		this.store = store;
		this.path = path;
		this.#metadata = metadata;
	}

	get attributes() {
		return this.#metadata.attributes;
	}
}

export class Array<
	Dtype extends DataType,
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
> {
	store: Store;
	path: AbsolutePath;
	codec_pipeline: CodecPipeline;
	#metadata: ArrayMetadata<Dtype>;

	constructor(
		store: Store,
		path: AbsolutePath,
		metadata: ArrayMetadata<Dtype>,
	) {
		this.store = store;
		this.path = path;
		this.codec_pipeline = create_codec_pipeline(metadata);
		this.#metadata = metadata;
	}

	_chunk_path(chunk_coords: number[]): AbsolutePath {
		let chunk_key = encode_chunk_key(chunk_coords, this.#metadata.chunk_key_encoding);
		return `${this.path}/${chunk_key}`;
	}

	async get_chunk(chunk_coords: number[], options?: Parameters<Store["get"]>[1]): Promise<Chunk<Dtype>> {
		let maybe_bytes = await this.store.get(this._chunk_path(chunk_coords), options);
		if (!maybe_bytes) {
			throw new Error(`Chunk not found: ${chunk_coords}`);
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

	get attributes() {
		return this.#metadata.attributes;
	}
}

