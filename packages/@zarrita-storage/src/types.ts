export type AbsolutePath<Rest extends string = string> = `/${Rest}`;

export type RangeQuery =
	| {
			offset: number;
			length: number;
	  }
	| {
			suffixLength: number;
	  };

export interface GetOptions {
	signal?: AbortSignal;
}

export type Readable = AsyncReadable | SyncReadable;
export interface AsyncReadable {
	get(key: AbsolutePath, opts?: GetOptions): Promise<Uint8Array | undefined>;
	getRange?(
		key: AbsolutePath,
		range: RangeQuery,
		opts?: GetOptions,
	): Promise<Uint8Array | undefined>;
}
export interface SyncReadable {
	get(key: AbsolutePath, opts?: GetOptions): Uint8Array | undefined;
	getRange?(
		key: AbsolutePath,
		range: RangeQuery,
		opts?: GetOptions,
	): Uint8Array | undefined;
}

export type Writable = AsyncWritable | SyncWritable;
export interface AsyncWritable {
	set(key: AbsolutePath, value: Uint8Array): Promise<void>;
}
export interface SyncWritable {
	set(key: AbsolutePath, value: Uint8Array): void;
}

export type AsyncMutable = AsyncReadable & AsyncWritable;
export type SyncMutable = SyncReadable & SyncWritable;
export type Mutable = AsyncMutable | SyncMutable;
