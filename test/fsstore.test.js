// @ts-check
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import FileSystemStore from "zarrita/storage/fs";
import { run_test_suite } from "./common.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
	name: "FileSystemStore",
	setup: async () => {
		const file_path = path.resolve(__dirname, "test.zr3");
		if (fs.existsSync(file_path)) await fs.promises.rm(file_path, { recursive: true });
		return {
			store: new FileSystemStore(file_path),
			get_json: async (/** @type {string} */ key) => {
				const blob = await fs.promises.readFile(file_path + "/" + key, {
					encoding: "utf-8",
				});
				return JSON.parse(blob);
			},
		};
	},
};

run_test_suite(config);
