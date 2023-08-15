import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

import FileSystemStore from "../src/fs.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const store_path = path.join(__dirname, "teststore");

beforeAll(async () => {
	await fs.mkdir(store_path);
});

afterAll(async () => {
	await fs.rm(store_path, { recursive: true });
});

describe("FileSystemStore", () => {
	it("writes a file", async () => {
		const store = new FileSystemStore(store_path);
		await store.set("/foo-write", new TextEncoder().encode("bar"));
		expect(
			await fs.readFile(path.join(store_path, "foo-write"), "utf-8"),
		).toBe("bar");
	});
	it("reads a file", async () => {
		const store = new FileSystemStore(store_path);
		await fs.writeFile(path.join(store_path, "foo-read"), "bar");
		expect(
			await store.get("/foo-read").then((buf) => new TextDecoder().decode(buf)),
		).toBe("bar");
	});
	it("returns undefined for a non-existent file", async () => {
		const store = new FileSystemStore(store_path);
		expect(await store.get("/foo-does-not-exist")).toBe(undefined);
	});
	it("deletes a file", async () => {
		const store = new FileSystemStore(store_path);
		await fs.writeFile(path.join(store_path, "foo-delete"), "bar");
		await store.delete("/foo-delete");
		expect(
			await fs
				.readFile(path.join(store_path, "foo-delete"), "utf-8")
				.catch((err) => err.code),
		).toBe("ENOENT");
	});
	it("checks if a file exists", async () => {
		const store = new FileSystemStore(store_path);
		await fs.writeFile(path.join(store_path, "foo-exists"), "bar");
		expect(await store.has("/foo-exists")).toBe(true);
		expect(await store.has("/foo-does-not-exist")).toBe(false);
	});
});
