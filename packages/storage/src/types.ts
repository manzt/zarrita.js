export type AbsolutePath<Rest extends string = string> = `/${Rest}`;

export type RootPath = AbsolutePath<"">;

export type PrefixPath = AbsolutePath<`${string}/`>;

export type Async<T extends Record<string, any>> = {
	[Key in keyof T]: (...args: Parameters<T[Key]>) => Promise<ReturnType<T[Key]>>;
};

export interface Readable<Opts = any> {
	get(key: AbsolutePath, opts?: Opts): Uint8Array | undefined;
}

export interface Writeable {
	set(key: AbsolutePath, value: Uint8Array): void;
}

export interface ListDirResult {
	contents: string[];
	prefixes: string[];
}

export interface ExtendedReadable extends Readable {
	list_prefix(key: RootPath | PrefixPath): string[];
	list_dir(key?: RootPath | PrefixPath): ListDirResult;
}

export type Deref<Path extends string, NodePath extends AbsolutePath> = Path extends
	AbsolutePath ? Path : NodePath extends "/" ? `/${Path}` : `${NodePath}/${Path}`;
