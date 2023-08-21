import type { AbsolutePath, Async, Readable } from "@zarrita/storage";
import type {
	ArrayMetadata,
	Chunk,
	DataType,
	GroupMetadata,
	Scalar,
	TypedArrayConstructor,
} from "./metadata.js";
import { type DataTypeQuery, is_dtype, type NarrowDataType } from "./util.js";
import { KeyError } from "./errors.js";
import { create_codec_pipeline } from "./codecs.js";
import {
	create_chunk_key_encoder,
	get_array_order,
	get_ctr,
	get_strides,
} from "./util.js";

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
	readonly kind = "group";
	#metadata: GroupMetadata;
	constructor(
		store: Store,
		path: AbsolutePath,
		metadata: GroupMetadata,
	) {
		super(store, path);
		this.#metadata = metadata;
	}
	get attrs() {
		return this.#metadata.attributes;
	}
}

const CONTEXT_MARKER = Symbol("zarrita.context");

export function get_context<T>(obj: { [CONTEXT_MARKER]: T }): T {
	return obj[CONTEXT_MARKER];
}

function create_context<D extends DataType>(
	metadata: ArrayMetadata<D>,
): ArrayContext<D> {
	let native_order = get_array_order(metadata);
	return {
		codec: create_codec_pipeline(metadata),
		encode_chunk_key: create_chunk_key_encoder(metadata.chunk_key_encoding),
		TypedArray: get_ctr(metadata.data_type),
		fill_value: metadata.fill_value,
		get_strides(shape: number[], order?: "C" | "F") {
			return get_strides(shape, order ?? native_order);
		},
	};
}

/** For internal use only, and is subject to change. */
interface ArrayContext<D extends DataType> {
	/** The codec pipeline for this array. */
	codec: ReturnType<typeof create_codec_pipeline<D>>;
	/** Encode a chunk key from chunk coordinates. */
	encode_chunk_key(chunk_coords: number[]): string;
	/** The TypedArray constructor for this array chunks. */
	TypedArray: TypedArrayConstructor<D>;
	/** A function to get the strides for a given shape, using the array order */
	get_strides(shape: number[], order?: "C" | "F"): number[];
	/** The fill value for this array. */
	fill_value: Scalar<D> | null;
}

export class Array<
	Dtype extends DataType,
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
> extends Location<Store> {
	readonly kind = "array";
	#metadata: ArrayMetadata<Dtype>;
	[CONTEXT_MARKER]: ArrayContext<Dtype>;

	constructor(
		store: Store,
		path: AbsolutePath,
		metadata: ArrayMetadata<Dtype>,
	) {
		super(store, path);
		this.#metadata = metadata;
		this[CONTEXT_MARKER] = create_context(metadata);
	}

	get attrs() {
		return this.#metadata.attributes;
	}

	get shape() {
		return this.#metadata.shape;
	}

	get chunks() {
		return this.#metadata.chunk_grid.configuration.chunk_shape;
	}

	get dtype() {
		return this.#metadata.data_type;
	}

	async getChunk(
		chunk_coords: number[],
		options?: Parameters<Store["get"]>[1],
	): Promise<Chunk<Dtype>> {
		let chunk_key = this[CONTEXT_MARKER].encode_chunk_key(chunk_coords);
		let chunk_path = this.resolve(chunk_key).path;
		let maybe_bytes = await this.store.get(chunk_path, options);
		if (!maybe_bytes) {
			throw new KeyError(chunk_path);
		}
		return this[CONTEXT_MARKER].codec.decode(maybe_bytes);
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
