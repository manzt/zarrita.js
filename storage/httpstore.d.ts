import type { Store } from '../core.js';
export default class HTTPStore implements Store {
    url: string;
    constructor(url: string);
    _path(key: string): string;
    get(key: string, _default?: Uint8Array): Promise<Uint8Array>;
    set(key: string, value: Uint8Array): void;
    delete(key: string): boolean;
    keys(): Generator<never, void, unknown>;
    list_prefix(): never[];
    list_dir(): {
        contents: never[];
        prefixes: never[];
    };
    repr(): string;
}
