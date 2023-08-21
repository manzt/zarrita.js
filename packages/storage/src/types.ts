export type AbsolutePath<Rest extends string = string> = `/${Rest}`;

export type GetOptions<T = {}> = T & {
	offset?: number;
	length?: number;
};

export type Readable<GetOptions = unknown> =
	| AsyncReadable<GetOptions>
	| SyncReadable<GetOptions>;
export interface AsyncReadable<Options = unknown> {
	get(
		key: AbsolutePath,
		opts?: GetOptions<Options>,
	): Promise<Uint8Array | undefined>;
	stat?(key: AbsolutePath): Promise<{ size: number }>;
}
export interface SyncReadable<Options = unknown> {
	get(key: AbsolutePath, opts?: GetOptions<Options>): Uint8Array | undefined;
	stat?(key: AbsolutePath): { size: number };
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
