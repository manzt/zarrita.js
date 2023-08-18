import type { Async, Readable } from "@zarrita/storage";

type ConsolidatedMetadata = {
	metadata: Record<string, Record<string, any>>;
	zarr_consolidated_format: 1;
};

type ConslidatedStore<Store> = Omit<Store, "metadata"> & {
	metadata: ConsolidatedMetadata;
};

/** Proxies requests to the underlying store. */
export async function withConsolidated<Store extends Async<Readable>>(
	store: Store,
): Promise<ConslidatedStore<Store>> {
	let meta_bytes = await store.get("/.zmetadata");
	if (!meta_bytes) throw new Error("No consolidated metadata found.");
	let meta: ConsolidatedMetadata = JSON.parse(
		new TextDecoder().decode(meta_bytes),
	);
	let encoder = new TextEncoder();
	return new Proxy(store as any, {
		get(target: Store, prop: string) {
			if (prop === "metadata") {
				return meta.metadata;
			}
			if (prop === "get") {
				// Intercept metadata requests
				return (...args: Parameters<Store["get"]>) => {
					let prefix = args[0].slice(1);
					if (prefix in meta.metadata) {
						let str = JSON.stringify(meta.metadata[prefix]);
						return Promise.resolve(encoder.encode(str));
					}
					return target.get(args[0], args[1]);
				};
			}
			return Reflect.get(target, prop);
		},
	});
}
