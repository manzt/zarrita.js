import type { KeyPrefix, SyncStore } from "../types";

class MemoryStore extends Map<string, Uint8Array> implements SyncStore {
	list_prefix<Prefix extends KeyPrefix>(prefix: Prefix) {
		const items = [];
		for (const path of super.keys()) {
			if (path.startsWith(prefix)) {
				items.push(path.split(prefix)[1]);
			}
		}
		return items;
	}

	list_dir<Prefix extends KeyPrefix>(key?: Prefix) {
		const prefix = key ?? "";
		const contents = [];
		const prefixes: Set<string> = new Set();

		for (const path of super.keys()) {
			if (path.includes(prefix)) {
				const name = prefix ? path.split(prefix)[1] : path;
				const segments = name.split("/");
				const item = segments[0];
				if (segments.length === 1) {
					// file
					contents.push(item);
				} else {
					prefixes.add(item);
				}
			}
		}

		return { contents, prefixes: [...prefixes] };
	}
}

export default MemoryStore;
