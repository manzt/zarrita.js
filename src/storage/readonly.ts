import type { AsyncStore } from "../types";

class ReadOnlyStore<Opts extends unknown = unknown> implements Omit<AsyncStore<Opts>, 'get' | 'has'> {

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
