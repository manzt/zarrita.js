import type { AsyncStore } from "../types";

class ReadOnlyStore<Opts = any> implements AsyncStore<Opts> {
	get(_key: string, _opts?: Opts): Promise<Uint8Array | undefined> {
		throw new Error("`get` must be implemented by sub-class");
	}

	has(_key: string): Promise<boolean> {
		throw new Error("`has` must be implemented");
	}

	set(_key: string, _value: Uint8Array): never {
		throw new Error("Store is read-only.");
	}

	delete(_key: string): never {
		throw new Error("Store is read-only.");
	}

	list_prefix() {
		return Promise.resolve([]);
	}

	list_dir() {
		return Promise.resolve({ contents: [], prefixes: [] });
	}
}

export default ReadOnlyStore;
