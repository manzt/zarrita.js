import { KeyError, NotImplementedError } from "./errors";
import { decode_chunk, get_ctr } from "./util";

import type {
	AbsolutePath,
	Async,
	Chunk,
	DataType,
	Deref,
	Readable,
	Scalar,
	TypedArrayConstructor,
} from "../types";
import type { Codec } from "numcodecs";

export class Node<Store, Path extends AbsolutePath> {
	constructor(public readonly store: Store, public readonly path: Path) {}
	get name() {
		return this.path.split("/").pop() ?? "";
	}
}

export class Group<Store, Path extends AbsolutePath = AbsolutePath>
	extends Node<Store, Path> {
	constructor(props: { store: Store; path: Path }) {
		super(props.store, props.path);
	}

	deref<P extends string>(path: P): Deref<P, Path> {
		if (path[0] !== "/") {
			// treat as relative path
			if ((this.path as any) === "/") {
				// special case root group
				path = `/${path}` as any;
			} else {
				path = `${this.path}/${path}` as any;
			}
		}
		return path as Deref<P, Path>;
	}
}

export interface ArrayProps<
	Dtype extends DataType,
	Store extends Readable | Async<Readable>,
	Path extends AbsolutePath,
> {
	store: Store;
	shape: number[];
	path: Path;
	chunk_shape: number[];
	dtype: Dtype;
	fill_value: Scalar<Dtype> | null;
	chunk_separator: "." | "/";
	compressor?: Codec;
	filters?: Codec[];
}

export class Array<
	Dtype extends DataType,
	Store extends Readable | Async<Readable> = Readable | Async<Readable>,
	Path extends AbsolutePath = AbsolutePath,
> extends Node<Store, Path> {
	readonly shape: readonly number[];
	readonly dtype: Dtype;
	readonly chunk_shape: readonly number[];
	readonly compressor?: Codec;
	readonly filters: readonly Codec[];
	readonly fill_value: Scalar<Dtype> | null;
	readonly TypedArray: TypedArrayConstructor<Dtype>;
	readonly chunk_separator: "." | "/";

	constructor(props: ArrayProps<Dtype, Store, Path>) {
		super(props.store, props.path);
		this.shape = props.shape;
		this.dtype = props.dtype;
		this.chunk_shape = props.chunk_shape;
		this.compressor = props.compressor;
		this.fill_value = props.fill_value;
		this.chunk_separator = props.chunk_separator;
		this.filters = props.filters ?? [];
		this.TypedArray = get_ctr(props.dtype);
	}

	get ndim() {
		return this.shape.length;
	}

	/** @hidden */
	protected chunk_key(_chunk_coords: number[]): AbsolutePath {
		throw new NotImplementedError("_chunk_key must be implemented on zarr.Array");
	}

	async get_chunk(
		chunk_coords: number[],
		opts?: Parameters<Store["get"]>[1],
	): Promise<Chunk<Dtype>> {
		const chunk_key = this.chunk_key(chunk_coords);
		const maybe_bytes = await this.store.get(chunk_key, opts);
		if (!maybe_bytes) {
			throw new KeyError(chunk_key);
		}
		const data = await decode_chunk(this, maybe_bytes);
		return { data, shape: this.chunk_shape.slice() };
	}
}
