import { mapEntries } from "jsr:@std/collections";

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

interface PackageJson {
	version: string;
	dependencies?: Record<string, string>;
}

interface JsrJson {
	name: string;
	version: string;
	imports: Record<string, string>;
	exports: string;
	exclude: string[];
}

let manifest: Record<string, JsrJson> = {};

// Collect all the JSR packages
for await (const pkg of Deno.readDir(new URL("../packages", import.meta.url))) {
	let pkgPath = new URL(`../packages/${pkg.name}/`, import.meta.url);
	let pkgJsonPath = new URL("package.json", pkgPath);
	let meta: PackageJson = JSON.parse(await Deno.readTextFile(pkgJsonPath));
	manifest[pkg.name] = {
		name: pkg.name === "zarrita" ? "@zarrita/zarrita" : pkg.name,
		version: meta.version,
		imports: meta.dependencies ?? {},
		exports: "./src/index.ts",
		exclude: ["node_modules", "dist", "package.json"],
	};
}

// Resolve workspace dependencies
for (const meta of Object.values(manifest)) {
	meta.imports = mapEntries(meta.imports, ([name, version]) => {
		if (version.startsWith("workspace:")) {
			let semanticResolution = version.slice("workspace:".length);
			let workspaceVersion = manifest[name.slice("@zarrita/".length)].version;
			assert(workspaceVersion, `Missing workspace version for ${name}`);
			assert(semanticResolution, `Missing semantic resolution for ${name}`);
			return [name, `jsr:${name}@${semanticResolution}${workspaceVersion}`];
		}
		return [name, `npm:${name}@${version}`];
	});
}

// Write the JSR manifest
for (const [name, meta] of Object.entries(manifest)) {
	let jsrJsonPath = new URL(`../packages/${name}/jsr.json`, import.meta.url);
	await Deno.writeTextFile(jsrJsonPath, JSON.stringify(meta, null, 2));
}
