import type { Store } from '../core.js';
export default class FileSystemStore implements Store {
    root: string;
    constructor(fp: string);
    get(key: string, _default?: Uint8Array): Promise<Uint8Array>;
    set(key: string, value: Uint8Array): Promise<void>;
    delete(key: string): Promise<boolean>;
    list_prefix(prefix: string): Promise<string[]>;
    list_dir(prefix?: string): Promise<{
        contents: string[];
        prefixes: string[];
    }>;
    keys(): AsyncGenerator<string, any, unknown>;
    repr(): string;
}
