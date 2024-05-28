import { mapEntries } from "jsr:@std/collections@0.224.2";

interface PackageJson {
	name: string;
	version: string;
	dependencies?: Record<string, string>;
	exports: Record<string, { import: string }>;
}

interface JsrJson {
	name: string;
	version: string;
	imports: Record<string, string>;
	exports: Record<string, string>;
	exclude: string[];
}

let MANIFEST: Record<string, JsrJson> = {};

// Collect all the JSR packages
for await (const pkg of Deno.readDir(new URL("../packages", import.meta.url))) {
	let pkgPath = new URL(`../packages/${pkg.name}/`, import.meta.url);
	let pkgJsonPath = new URL("package.json", pkgPath);
	let meta: PackageJson = JSON.parse(await Deno.readTextFile(pkgJsonPath));
	MANIFEST[pkg.name] = {
		name: meta.name === "zarrita" ? "@zarrita/zarrita" : meta.name,
		version: meta.version,
		imports: meta.dependencies ?? {},
		exports: mapEntries(meta.exports, ([key, { import: value }]) => [
			key,
			value,
		]),
		exclude: ["node_modules", "dist", "package.json"],
	};
}

// Resolve workspace dependencies
for (const meta of Object.values(MANIFEST)) {
	meta.imports = mapEntries(meta.imports, ([name, version]) => {
		if (version.startsWith("workspace:")) {
			let semanticResolution = version.slice("workspace:".length);
			let workspaceVersion = MANIFEST[name.slice("@zarrita/".length)].version;
			assert(workspaceVersion, `Missing workspace version for ${name}`);
			assert(semanticResolution, `Missing semantic resolution for ${name}`);
			return [name, `jsr:${name}@${semanticResolution}${workspaceVersion}`];
		}
		return [name, `npm:${name}@${version}`];
	});
}

// Write the JSR manifest
for (const [name, meta] of Object.entries(MANIFEST)) {
	let jsrJsonPath = new URL(`../packages/${name}/jsr.json`, import.meta.url);
	await Deno.writeTextFile(
		jsrJsonPath,
		`${JSON.stringify(meta, null, "\t")}\n`,
	);
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}
