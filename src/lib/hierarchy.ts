import { KeyError } from "./errors";
import { byte_swap_inplace, get_ctr, should_byte_swap } from "./util";

import type {
	AbsolutePath,
	Attrs,
	DataType,
	Hierarchy,
	Scalar,
	Store,
	TypedArray,
	TypedArrayConstructor,
} from "../types";
import type { Codec } from "numcodecs";

export class Node<S extends Store> {
	constructor(public readonly store: S, public readonly path: AbsolutePath) {}

	get name() {
		return this.path.split("/").pop() ?? "";
	}
}

export class Group<S extends Store, H extends Hierarchy<S>> extends Node<S> {
	readonly owner: H;
	constructor(props: { store: S; path: AbsolutePath; owner: H }) {
		super(props.store, props.path);
		this.owner = props.owner;
	}

	async get_children() {
		return this.owner.get_children(this.path);
	}

	_deref(path: string): AbsolutePath {
		if (path[0] !== "/") {
			// treat as relative path
			if (this.path === "/") {
				// special case root group
				path = `/${path}`;
			} else {
				path = `${this.path}/${path}`;
			}
		}
		return path as AbsolutePath;
	}

	get(path: string) {
		return this.owner.get(this._deref(path));
	}

	has(path: string) {
		return this.owner.has(this._deref(path));
	}

	create_group(path: string, props: { attrs?: Attrs } = {}) {
		return this.owner.create_group(this._deref(path), props);
	}

	create_array(
		path: string,
		props: Parameters<H["create_array"]>[1],
	) {
		return this.owner.create_array(this._deref(path), props);
	}

	get_array(path: string) {
		return this.owner.get_array(this._deref(path));
	}

	get_group(path: string) {
		return this.owner.get_group(this._deref(path));
	}

	get_implicit_group(path: string) {
		return this.owner.get_implicit_group(this._deref(path));
	}
}

interface ExplicitGroupProps<S extends Store, H extends Hierarchy<S>> {
	store: S;
	path: AbsolutePath;
	owner: H;
	attrs: Attrs | (() => Promise<Attrs>);
}

export class ExplicitGroup<S extends Store, H extends Hierarchy<S>> extends Group<S, H> {
	private _attrs: Attrs | (() => Promise<Attrs>);

	constructor(props: ExplicitGroupProps<S, H>) {
		super(props);
		this._attrs = props.attrs || {};
	}

	get attrs(): Promise<Attrs> {
		if (typeof this._attrs === "object") {
			return Promise.resolve(this._attrs);
		}
		return this._attrs().then((attrs) => {
			this._attrs = attrs;
			return attrs;
		});
	}
}

export class ImplicitGroup<S extends Store, H extends Hierarchy<S>> extends Group<S, H> {}

export interface ZarrArrayProps<D extends DataType, S extends Store> {
	store: S;
	shape: number[];
	path: AbsolutePath;
	chunk_shape: number[];
	dtype: D;
	fill_value: Scalar<D> | null;
	attrs: Attrs | (() => Promise<Attrs>);
	chunk_key: (chunk_coords: number[]) => AbsolutePath;
	compressor?: import("numcodecs").Codec;
}

export class ZarrArray<D extends DataType, S extends Store> extends Node<S> {
	readonly shape: number[];
	readonly dtype: D;
	readonly chunk_shape: number[];
	readonly compressor?: Codec;
	readonly fill_value: Scalar<D> | null;
	readonly chunk_key: ZarrArrayProps<D, S>["chunk_key"];
	readonly TypedArray: TypedArrayConstructor<D>;
	private _attrs: Attrs | (() => Promise<Attrs>);

	constructor(props: ZarrArrayProps<D, S>) {
		super(props.store, props.path);
		this.shape = props.shape;
		this.dtype = props.dtype;
		this.chunk_shape = props.chunk_shape;
		this.compressor = props.compressor;
		this.fill_value = props.fill_value;
		this.chunk_key = props.chunk_key;
		this.TypedArray = get_ctr(props.dtype);
		this._attrs = props.attrs;
	}

	get attrs() {
		if (typeof this._attrs === "object") {
			return Promise.resolve(this._attrs);
		}
		return this._attrs().then((attrs) => {
			// cache the result
			this._attrs = attrs;
			return attrs;
		});
	}

	get ndim() {
		return this.shape.length;
	}

	async _decode_chunk(bytes: Uint8Array): Promise<TypedArray<D>> {
		if (this.compressor) {
			bytes = await this.compressor.decode(bytes);
		}

		const data = new this.TypedArray(bytes.buffer);

		if (should_byte_swap(this.dtype)) {
			byte_swap_inplace(data);
		}

		return data;
	}

	async _encode_chunk(data: TypedArray<D>): Promise<Uint8Array> {
		if (should_byte_swap(this.dtype)) {
			byte_swap_inplace(data);
		}
		let bytes = new Uint8Array(data.buffer);
		if (this.compressor) {
			bytes = await this.compressor.encode(bytes);
		}
		return bytes;
	}

	async get_chunk(
		chunk_coords: number[],
	): Promise<{ data: TypedArray<D>; shape: number[] }> {
		const chunk_key = this.chunk_key(chunk_coords);
		const buffer = await this.store.get(chunk_key);
		if (!buffer) throw new KeyError(chunk_key);
		const data = await this._decode_chunk(buffer);
		return { data, shape: this.chunk_shape };
	}
}
