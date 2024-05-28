import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * @typedef PackageJson
 * @property {string} name
 * @property {string} version
 * @property {Record<string, string>} [dependencies]
 * @property {Record<string, { import: string }>} exports
 */

/**
 * @typedef JsrJson
 * @property {string} name
 * @property {string} version
 * @property {Record<string, string>} imports
 * @property {Record<string, string>} exports
 * @property {{ exclude: string[] }} publish
 */

/** @type {Record<string, JsrJson>} */
let MANIFEST = {};

// Collect all the JSR packages
const packagesPath = path.resolve(import.meta.dirname, "../packages");
const packageDirs = await fs.readdir(packagesPath, { withFileTypes: true });
for (const pkg of packageDirs) {
	if (pkg.isDirectory()) {
		const pkgPath = path.resolve(packagesPath, pkg.name);
		const pkgJsonPath = path.resolve(pkgPath, "package.json");
		/** @type {PackageJson} */
		const meta = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
		MANIFEST[pkg.name] = {
			name: meta.name === "zarrita" ? "@zarrita/zarrita" : meta.name,
			version: meta.version,
			imports: meta.dependencies ?? {},
			exports: mapEntries(meta.exports, ([key, { import: value }]) => [
				key,
				value,
			]),
			publish: {
				exclude: ["package.json"],
			},
		};
	}
}

// Resolve workspace dependencies
for (const meta of Object.values(MANIFEST)) {
	meta.imports = mapEntries(meta.imports, ([name, version]) => {
		if (version.startsWith("workspace:")) {
			const semanticResolution = version.slice("workspace:".length);
			const workspaceVersion = MANIFEST[name.slice("@zarrita/".length)].version;
			assert(workspaceVersion, `Missing workspace version for ${name}`);
			assert(semanticResolution, `Missing semantic resolution for ${name}`);
			return [name, `jsr:${name}@${semanticResolution}${workspaceVersion}`];
		}
		return [name, `npm:${name}@${version}`];
	});
}

// Write the JSR manifest
for (const [name, meta] of Object.entries(MANIFEST)) {
	const jsrJsonPath = path.resolve(packagesPath, name, "jsr.json");
	await fs.writeFile(
		jsrJsonPath,
		`${JSON.stringify(meta, null, "\t")}\n`,
		"utf-8",
	);
}

/**
 * @param {unknown} condition
 * @param {string} message
 * @returns {asserts condition}
 */
function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

/**
 * @template T, O
 * @param {Readonly<Record<string, T>>} record
 * @param {(entry: [string, T]) => [string, O]} transformer
 * @returns {Record<string, O>}
 */
function mapEntries(record, transformer) {
	/** @type {Record<string, O>} */
	const ret = {};
	const entries = Object.entries(record);

	for (const entry of entries) {
		const [mappedKey, mappedValue] = transformer(entry);

		ret[mappedKey] = mappedValue;
	}

	return ret;
}
