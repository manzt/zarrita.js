import type { AbsolutePath, Async, Readable } from "@zarrita/storage";
import type {
	ArrayMetadata,
	DataType,
	GroupMetadata,
	Scalar,
} from "./metadata.js";
import type { Chunk } from "./types.js";

import { create_codec_pipeline } from "./codecs.js";
import { encode_chunk_key, json_decode_object } from "./util.js";
import { v2_marker } from "./metadata.js";
import { KeyError } from "./errors.js";

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

export function root<Store>(store: Store): Location<Store> {
	return new Location(store);
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
			let attrs = await this.store.get(this.resolve(".zattrs").path);
			this.#attributes = (attrs && json_decode_object(attrs)) || {};
		} else {
			this.#attributes = this.#metadata.attributes;
		}
		return this.#attributes ?? {};
	}
}

export class Array<
	Dtype extends DataType,
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
> extends Location<Store> {
	codec_pipeline: ReturnType<typeof create_codec_pipeline>;
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
	): Promise<Chunk<Dtype>> {
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
		} else {
			this.#attributes = this.#metadata.attributes;
		}
		return this.#attributes ?? {};
	}
}
