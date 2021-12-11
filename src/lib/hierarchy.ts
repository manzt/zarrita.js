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

export class Node<S extends Store, Path extends AbsolutePath> {
	constructor(public readonly store: S, public readonly path: Path) {}

	get name() {
		return this.path.split("/").pop() ?? "";
	}
}

export class Group<
	S extends Store,
	H extends Hierarchy<S>,
	P extends AbsolutePath = AbsolutePath,
> extends Node<S, P> {
	readonly owner: H;
	constructor(props: { store: S; path: P; owner: H }) {
		super(props.store, props.path);
		this.owner = props.owner;
	}

	async get_children() {
		return this.owner.get_children(this.path);
	}

	_deref<Path extends string>(
		path: Path,
	): Path extends AbsolutePath ? Path : P extends "/" ? `/${Path}` : `${P}/${Path}` {
		if (path[0] !== "/") {
			// treat as relative path
			if ((this.path as any) === "/") {
				// special case root group
				path = `/${path}` as any;
			} else {
				path = `${this.path}/${path}` as any;
			}
		}
		return path as any;
	}

	get<Path extends string>(path: Path) {
		return this.owner.get(this._deref(path));
	}

	has<Path extends string>(path: Path) {
		return this.owner.has(this._deref(path));
	}

	create_group<Path extends string>(path: Path, props: { attrs?: Attrs } = {}) {
		return this.owner.create_group(this._deref(path), props);
	}

	create_array<Path extends string>(
		path: Path,
		props: Parameters<H["create_array"]>[1],
	) {
		return this.owner.create_array(this._deref(path), props);
	}

	get_array<Path extends string>(path: Path) {
		return this.owner.get_array(this._deref(path));
	}

	get_group<Path extends string>(path: Path) {
		return this.owner.get_group(this._deref(path));
	}

	get_implicit_group<Path extends string>(path: Path) {
		return this.owner.get_implicit_group(this._deref(path));
	}
}

interface ExplicitGroupProps<
	P extends AbsolutePath,
	S extends Store,
	H extends Hierarchy<S>,
> {
	store: S;
	path: P;
	owner: H;
	attrs: Attrs | (() => Promise<Attrs>);
}

export class ExplicitGroup<
	S extends Store,
	H extends Hierarchy<S>,
	P extends AbsolutePath = AbsolutePath,
> extends Group<S, H, P> {
	private _attrs: Attrs | (() => Promise<Attrs>);

	constructor(props: ExplicitGroupProps<P, S, H>) {
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

export class ImplicitGroup<
	S extends Store,
	H extends Hierarchy<S>,
	P extends AbsolutePath = AbsolutePath,
> extends Group<S, H, P> {}

export interface ZarrArrayProps<
	P extends AbsolutePath,
	D extends DataType,
	S extends Store,
> {
	store: S;
	shape: number[];
	path: P;
	chunk_shape: number[];
	dtype: D;
	fill_value: Scalar<D> | null;
	attrs: Attrs | (() => Promise<Attrs>);
	chunk_key: (chunk_coords: number[]) => AbsolutePath;
	compressor?: import("numcodecs").Codec;
}

export class ZarrArray<
	D extends DataType,
	S extends Store,
	P extends AbsolutePath = AbsolutePath,
> extends Node<S, P> {
	readonly shape: number[];
	readonly dtype: D;
	readonly chunk_shape: number[];
	readonly compressor?: Codec;
	readonly fill_value: Scalar<D> | null;
	readonly chunk_key: ZarrArrayProps<P, D, S>["chunk_key"];
	readonly TypedArray: TypedArrayConstructor<D>;
	private _attrs: Attrs | (() => Promise<Attrs>);

	constructor(props: ZarrArrayProps<P, D, S>) {
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
