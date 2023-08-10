import type { AbsolutePath, Async, Readable } from "@zarrita/storage";
import type {
	ArrayMetadata,
	Chunk,
	DataType,
	GroupMetadata,
	Scalar,
} from "./metadata.js";
import { create_codec_pipeline } from "./codecs.js";
import {
	type DataTypeQuery,
	encode_chunk_key,
	is_dtype,
	json_decode_object,
	type NarrowDataType,
	v2_marker,
} from "./util.js";
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

export function root<Store>(store: Store): Location<Store>;

export function root(): Location<Map<string, Uint8Array>>;

export function root<Store>(
	store?: any,
): Location<Store | Map<string, Uint8Array>> {
	return new Location(store ?? new Map());
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

	/**
	 * A helper method to narrow `zarr.Array` Dtype.
	 *
	 * ```typescript
	 * let arr: zarr.Array<DataType, FetchStore> = zarr.open(store, { kind: "array" });
	 *
	 * // Option 1: narrow by scalar type (e.g. "bool", "raw", "bigint", "number")
	 * if (arr.is("bigint")) {
	 *   // zarr.Array<"int64" | "uint64", FetchStore>
	 * }
	 *
	 * // Option 3: exact match
	 * if (arr.is("float32")) {
	 *   // zarr.Array<"float32", FetchStore, "/">
	 * }
	 * ```
	 */
	is<Query extends DataTypeQuery>(
		query: Query,
	): this is Array<NarrowDataType<Dtype, Query>, Store> {
		return is_dtype(this.dtype, query);
	}
}
