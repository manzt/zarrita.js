import { assert } from "../lib/errors";

import type { SyncStore } from "../types";

export class MemoryStore extends Map<string, Uint8Array> implements SyncStore {

	list_prefix(prefix: string) {
		assert(
			prefix[prefix.length - 1] === "/",
			"Prefix must end with '/'.",
		);
		const items = [];
		for (const path of super.keys()) {
			if (path.startsWith(prefix)) {
				items.push(path.split(prefix)[1]);
			}
		}
		return items;
	}

	list_dir(prefix = "") {
		if (prefix) {
			assert(
				prefix[prefix.length - 1] === "/",
				"Prefix must end with '/'",
			);
		}

		const contents = [];
		const prefixes: Set<string> = new Set;

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
