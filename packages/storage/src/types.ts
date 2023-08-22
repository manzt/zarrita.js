export type AbsolutePath<Rest extends string = string> = `/${Rest}`;

export type RangeQuery = {
	offset: number;
	length: number;
} | {
	suffixLength: number;
};

export type Readable<GetOptions = unknown> =
	| AsyncReadable<GetOptions>
	| SyncReadable<GetOptions>;
export interface AsyncReadable<Options = unknown> {
	get(
		key: AbsolutePath,
		opts?: Options,
	): Promise<Uint8Array | undefined>;
	getRange?(
		key: AbsolutePath,
		range: RangeQuery,
		opts?: Options,
	): Promise<Uint8Array | undefined>;
}
export interface SyncReadable<Options = unknown> {
	get(
		key: AbsolutePath,
		opts?: Options,
	): Uint8Array | undefined;
	getRange?(
		key: AbsolutePath,
		range: RangeQuery,
		opts?: Options,
	): Uint8Array | undefined;
}

export type Writeable = AsyncWriteable | SyncWriteable;
export interface AsyncWriteable {
	set(key: AbsolutePath, value: Uint8Array): Promise<void>;
}
export interface SyncWriteable {
	set(key: AbsolutePath, value: Uint8Array): void;
}

export type AsyncMutable<GetOptions = unknown> =
	& AsyncReadable<GetOptions>
	& AsyncWriteable;
export type SyncMutable<GetOptions = unknown> =
	& SyncReadable<GetOptions>
	& SyncWriteable;
export type Mutable<GetOptions = unknown> =
	| AsyncMutable<GetOptions>
	| SyncMutable<GetOptions>;
