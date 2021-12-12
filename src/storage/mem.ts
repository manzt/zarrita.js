import type {
	ExtendedReadable,
	PrefixPath,
	Readable,
	RootPath,
	Writeable,
} from "../types";

class MemoryStore extends Map<string, Uint8Array>
	implements Readable, Writeable, ExtendedReadable {
	list_prefix(prefix: RootPath | PrefixPath) {
		const items = [];
		for (const path of super.keys()) {
			if (path.startsWith(prefix)) {
				items.push(path.split(prefix)[1]);
			}
		}
		return items;
	}

	list_dir(prefix: RootPath | PrefixPath = "/") {
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
