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
		if (fs.existsSync(file_path)) {
			await fs.promises.rm(file_path, { recursive: true });
		}
		return new FileSystemStore(file_path);
	},
};

run_test_suite(config);
