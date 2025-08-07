import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ZipInfo } from "unzipit";
import ZipFileStore from "../src/zip.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const fixtures_dir = path.join(__dirname, "..", "..", "..", "fixtures");
const store_v2_zipped_from_within_path = path.join(fixtures_dir, "v2", "data.zipped_from_within.zarr.zip");
const store_v2_zipped_from_parent_path = path.join(fixtures_dir, "v2", "data.zipped_from_parent.zarr.zip");
const store_v3_zipped_from_within_path = path.join(fixtures_dir, "v3", "data.zipped_from_within.zarr.zip");
const store_v3_zipped_from_parent_path = path.join(fixtures_dir, "v3", "data.zipped_from_parent.zarr.zip");

describe("ZipFileStore", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("store creation from blob works for v2", async () => {
		let zipBuffer = await fs.readFile(store_v2_zipped_from_within_path);
        let blob = new Blob([zipBuffer], { type: "application/zip" });
		let store = ZipFileStore.fromBlob(blob);
        expect(store).toBeInstanceOf(ZipFileStore);

		let bytes = await store.get("/.zgroup");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
              "zarr_format": 2,
            }
		`);
	});
    it("store creation from blob works for v3", async () => {
		let zipBuffer = await fs.readFile(store_v3_zipped_from_within_path);
        let blob = new Blob([zipBuffer], { type: "application/zip" });
		let store = ZipFileStore.fromBlob(blob);
        expect(store).toBeInstanceOf(ZipFileStore);

		let bytes = await store.get("/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
              "attributes": {},
              "consolidated_metadata": null,
              "node_type": "group",
              "zarr_format": 3,
            }
		`);
	});
    it("store creation from blob works for v3, second fixture", async () => {
		let zipBuffer = await fs.readFile(store_v3_zipped_from_parent_path);
        let blob = new Blob([zipBuffer], { type: "application/zip" });
		let store = ZipFileStore.fromBlob(blob);
        expect(store).toBeInstanceOf(ZipFileStore);

		let bytes = await store.get("/data.zarr/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
              "attributes": {},
              "consolidated_metadata": null,
              "node_type": "group",
              "zarr_format": 3,
            }
		`);
	});
	it("providing a transform entries function via zip store options works", async () => {
        // Define a transformEntries function that expects a single top-level .zarr directory
        // and strips that prefix from all entries.
		let transformEntries = (entries: ZipInfo["entries"]) => {
            // Find all top-level directories that end with .zarr
            let topLevelZarrDirectories = new Set(
                Object.keys(entries)
                    .map(k => k.split('/')[0])
                    .filter(firstPathItem => firstPathItem?.endsWith('.zarr'))
            );
            // Check that there is exactly one such directory.
            if (topLevelZarrDirectories.size !== 1) {
                throw Error(`expected exactly one top-level .zarr directory`);
            }
            let topLevelZarrDirectory = Array.from(topLevelZarrDirectories)[0];
            // Modify the entries to strip the top-level .zarr directory prefix from paths.
            let newEntries = Object.fromEntries(
                Object.entries(entries).map(([k, v]) => {
                    let newKey = k;
                    if (k.split('/')[0] === topLevelZarrDirectory) {
                        // Use substring to remove the top-level directory name
                        // and the following slash from the internal zip paths.
                        newKey = k.substring(topLevelZarrDirectory.length + 1);
                    }
                    return [newKey, v];
                })
            );
            return newEntries;
        }
        let zipBuffer = await fs.readFile(store_v2_zipped_from_parent_path);
        let blob = new Blob([zipBuffer], { type: "application/zip" });
        // Pass the transformEntries function via the ZipFileStore options.
		let store = ZipFileStore.fromBlob(blob, { transformEntries });
		let bytes = await store.get("/.zgroup");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
              "zarr_format": 2,
            }
		`);
	});
});
