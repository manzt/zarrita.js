// @ts-check
import { test } from "zora";

import { v3 } from "zarrita";
import { get, set } from "zarrita/ndarray";
import ndarray from "ndarray";

import GZip from "numcodecs/gzip";
// add dynamic codec to registry
// @ts-ignore
v3.registry.set("gzip", () => GZip);

/** @param {Uint8Array} bytes */
function json(bytes) {
	const str = new TextDecoder().decode(bytes);
	return JSON.parse(str);
}

/**
 * @template {any} T
 * @typedef {import('../src/types').Async<T>} Async<T>
 */

/** @typedef {import('../src/types').ExtendedReadable} ExtendedReadable */
/** @typedef {import('../src/types').Writeable} Writeable */
/** @typedef {(ExtendedReadable & Writeable) | Async<ExtendedReadable & Writeable>} Store */

/** @param {{ name: string, setup: () => Promise<Store>}} props */
export function run_test_suite({ name, setup }) {
	test(`Zarrita test suite: ${name}.`, async (t) => {
		const store = await setup();
		const h = await v3.create_hierarchy(store);

		await t.test("Create a hierarchy", async (t) => {
			t.ok(store, "created store.");
			t.ok(h, "created hierarchy.");
		});

		await t.test("Check root json", async (t) => {
			const m = json(await store.get("/zarr.json"));
			t.equal(Object.keys(m).length, 4, "should have 4 keys.");
			t.equal(
				m.zarr_format,
				"https://purl.org/zarr/spec/protocol/core/3.0",
				"should be valid zarr_format url.",
			);
			t.equal(
				m.metadata_encoding,
				"https://purl.org/zarr/spec/protocol/core/3.0",
				"correct metadata_encoding.",
			);
			t.equal(
				m.metadata_key_suffix,
				".json",
				"should have meta suffix of .json.",
			);
			t.equal(m.extensions, [], "should have no extensions.");
		});

		await t.test("Create an array", async (t) => {
			const a = await v3.create_array(h, "/arthur/dent", {
				shape: [5, 10],
				dtype: "<i4",
				chunk_shape: [2, 5],
				compressor: GZip.fromConfig({ level: 1, id: "gzip" }),
				attrs: { question: "life", answer: 42 },
			});
			t.equal(a.path, "/arthur/dent", "should have path /arthur/dent.");
			t.equal(a.name, "dent", "should have name dent.");
			t.equal(a.ndim, 2, "should have ndim of 2.");
			t.equal(a.shape, [5, 10], "should have shape: [5, 10].");
			t.equal(a.dtype, "<i4", "should have dtype <i4.");
			t.equal(a.chunk_shape, [2, 5], "should have chunk_shape [2, 5].");
			t.equal(
				(await a.attrs()).question,
				"life",
				'should have question attrs of "life"',
			);
			t.equal((await a.attrs()).answer, 42, "should have answer attrs of 42");
		});

		await t.test("Verify /arthur/dent metadata", async (t) => {
			const m = json(await store.get("/meta/root/arthur/dent.array.json"));
			t.equal(m.shape, [5, 10], "should have shape [5, 10].");
			t.equal(m.data_type, "<i4", "should have dtype <i4.");
			t.equal(m.chunk_grid.type, "regular", "chunk_grid should be regular.");
			t.equal(
				m.chunk_grid.chunk_shape,
				[2, 5],
				"should have chunk_shape [2, 5].",
			);
			t.equal(
				m.chunk_grid.separator,
				"/",
				'should have chunk separator of "/".',
			);
			t.equal(m.chunk_memory_layout, "C", 'should have "C" memory layout.');
			t.equal(m.fill_value, null, "should have null fill_value.");
			t.equal(m.extensions, [], "should not have extensions.");
			t.equal(
				m.attributes.question,
				"life",
				'should have attributes of question be "life".',
			);
			t.equal(
				m.attributes.answer,
				42,
				"should have attributes of answer be 42.",
			);
			t.equal(
				m.compressor.codec,
				"https://purl.org/zarr/spec/codec/gzip/1.0",
				"should have correct gzip url.",
			);
			t.equal(
				m.compressor.configuration.level,
				1,
				"should have gzip compression level of 1.",
			);
		});

		await t.test("Create an array with no compressor", async (t) => {
			const a = await v3.create_array(h, "/deep/thought", {
				shape: [7500000],
				dtype: ">f8",
				chunk_shape: [42],
			});
			t.equal(a.path, "/deep/thought", "should have path /deep/thought.");
			t.equal(a.name, "thought", "should have name thought.");
			t.equal(a.ndim, 1, "should have ndim of 1`.");
			t.deepEqual(a.shape, [7500000], "should have shape: [7500000].");
			t.equal(a.dtype, ">f8", "should have dtype >f8.");
			t.equal(a.chunk_shape, [42], "should have chunk_shape [42].");
			t.equal((await a.attrs()), {}, "should have empty attrs.");
		});

		await t.test("Verify /deep/thought metadata", async (t) => {
			const m = json(await store.get("/meta/root/deep/thought.array.json"));
			t.equal(m.shape, [7500000], "should have shape [7500000].");
			t.equal(m.data_type, ">f8", "should have dtype >f8.");
			t.equal(m.chunk_grid.type, "regular", "chunk_grid should be regular.");
			t.equal(m.chunk_grid.chunk_shape, [42], "should have chunk_shape [42].");
			t.equal(
				m.chunk_grid.separator,
				"/",
				'should have chunk separator of "/".',
			);
			t.equal(m.chunk_memory_layout, "C", 'should have "C" memory layout.');
			t.equal(m.fill_value, null, "should have null fill_value.");
			t.equal(m.extensions, [], "should not have extensions.");
			t.equal(m.attributes, {}, "should have empty attributes.");
			t.ok(m.compressor === undefined, "should not have compressor.");
		});

		await t.test("Create a group", async (t) => {
			const g = await v3.create_group(h, "/tricia/mcmillan", {
				attrs: { heart: "gold", improbability: "infinite" },
			});
			t.equal(g.path, "/tricia/mcmillan", "should have path /tricia/mcmillan.");
			t.equal(g.name, "mcmillan", "should have name mcmillan.");
			const attrs = await g.attrs();
			t.equal(attrs.heart, "gold", "should have heart of gold.");
			t.equal(
				attrs.improbability,
				"infinite",
				"should have inifinite improbability.",
			);
		});

		await t.test("Create nodes via groups", async (t) => {
			const marvin = await v3.create_group(h, "/marvin");
			const paranoid = await v3.create_group(marvin, "paranoid");
			const android = await v3.create_array(marvin, "android", {
				shape: [42, 42],
				dtype: "|u1",
				chunk_shape: [2, 2],
			});
			t.ok(marvin instanceof v3.ExplicitGroup);
			t.equal(marvin.path, "/marvin");
			t.ok(paranoid instanceof v3.ExplicitGroup);
			t.equal(paranoid.path, "/marvin/paranoid");
			t.ok(android instanceof v3.Array);
			t.equal(android.path, "/marvin/android");
		});

		await t.test("Access an array", async (t) => {
			const a = /** @type {v3.Array<any, any>} */ (await v3.get(h, "/arthur/dent"));
			t.equal(a.path, "/arthur/dent", "should have path /arthur/dent.");
			t.equal(a.name, "dent", "should have name dent.");
			t.equal(a.ndim, 2, "should have ndim of 2.");
			t.equal(a.shape, [5, 10], "should have shape: [5, 10].");
			t.equal(a.dtype, "<i4", "should have dtype <i4.");
			t.equal(a.chunk_shape, [2, 5], "should have chunk_shape [2, 5].");
			t.equal(
				(await a.attrs()).question,
				"life",
				'should have question attrs of "life"',
			);
			t.equal((await a.attrs()).answer, 42, "should have answer attrs of 42");
		});

		await t.test("Access an explicit group", async (t) => {
			const g =
				/** @type {v3.ExplicitGroup<any, any>} */ (await v3.get(h, "/tricia/mcmillan"));
			const attrs = await g.attrs();
			t.equal(attrs.heart, "gold", "should have attrs heart of gold.");
			t.equal(
				attrs.improbability,
				"infinite",
				"should have attrs improbability of infinite.",
			);
		});

		await t.test("Access implicit groups", async (t) => {
			const root = await v3.get(h, "/");
			const arthur = await v3.get(h, "/arthur");
			t.equal(root.path, "/");
			t.ok(root instanceof v3.ImplicitGroup);
			t.equal(arthur.path, "/arthur");
			t.ok(arthur instanceof v3.ImplicitGroup);
			const tricia = await v3.get(h, "/tricia");
			t.equal(tricia.path, "/tricia");
			t.ok(tricia instanceof v3.ImplicitGroup);
		});

		await t.test("Access nodes - convenience", async (t) => {
			t.ok((await v3.get(h, "/")) instanceof v3.ImplicitGroup);
			t.ok((await v3.get(h)) instanceof v3.ImplicitGroup);
			t.ok((await v3.get(h, "/arthur")) instanceof v3.ImplicitGroup);
			t.ok((await v3.get(h, "/tricia/mcmillan")) instanceof v3.ExplicitGroup);
		});

		await t.test("Explore hierarchy top-down", async (t) => {
			let res = await v3.get_children(h, "/");
			t.equal(
				res.get("arthur"),
				"implicit_group",
				"arthur should be implicit_group.",
			);
			t.equal(
				res.get("deep"),
				"implicit_group",
				"deep should be implicit_group.",
			);
			t.equal(
				res.get("marvin"),
				"explicit_group",
				"marvin should be explicit group.",
			);
			t.equal(
				res.get("tricia"),
				"implicit_group",
				"tricia should be implicit group.",
			);

			res = await v3.get_children(h, "/tricia");
			t.equal(
				res.get("mcmillan"),
				"explicit_group",
				"tricia/mcmillan should be explicit group.",
			);

			res = await v3.get_children(h, "/tricia");
			res = await v3.get_children(h, "/arthur");
			t.equal(res.get("dent"), "array", "dent should be an array.");
		});

		await t.test("Alternate way to explore hierarchy", async (t) => {
			let res = await v3.get_children(h);
			t.equal(
				res.get("arthur"),
				"implicit_group",
				"arthur should be implicit_group.",
			);
			t.equal(
				res.get("deep"),
				"implicit_group",
				"deep should be implicit_group.",
			);
			t.equal(
				res.get("marvin"),
				"explicit_group",
				"marvin should be explicit group.",
			);
			t.equal(
				res.get("tricia"),
				"implicit_group",
				"tricia should be implicit group.",
			);

			let grp = await v3.get_implicit_group(h, "/tricia");
			res = await v3.get_children(grp);
			t.equal(
				res.get("mcmillan"),
				"explicit_group",
				"tricia/mcmillan should be explicit group.",
			);

			// @ts-ignore
			res = await v3.get(h, "/tricia").then((n) => v3.get(n, "mcmillan")).then((n) =>
				v3.get_children(n)
			);

			// @ts-ignore
			res = await v3.get(h, "/arthur").then((n) => v3.get_children(n));
			t.equal(res.get("dent"), "array", "dent should be an array.");
		});

		await t.test("View the whole hierarchy in one go", async (t) => {
			const n = await v3.get_nodes(h);
			t.equal(n.get("/"), "implicit_group", '"/" should be implicit_group.');
			t.equal(
				n.get("/arthur"),
				"implicit_group",
				'"/arthur" should be implicit_group.',
			);
			t.equal(
				n.get("/arthur/dent"),
				"array",
				'"/arthur/dent" should be array.',
			);
			t.equal(
				n.get("/deep"),
				"implicit_group",
				'"/deep" should be implicit_group.',
			);
			t.equal(
				n.get("/deep/thought"),
				"array",
				'"/deep/thought" should be array.',
			);
			t.equal(
				n.get("/marvin"),
				"explicit_group",
				'"/marvin" should be explicit_group.',
			);
			t.equal(
				n.get("/marvin/android"),
				"array",
				'"/marvin/android" should be array.',
			);
			t.equal(
				n.get("/marvin/paranoid"),
				"explicit_group",
				'"/marvin/paranoid" should be explicit_group.',
			);
			t.equal(
				n.get("/tricia"),
				"implicit_group",
				'"/tricia" should be implicit_group.',
			);
			t.equal(
				n.get("/tricia/mcmillan"),
				"explicit_group",
				'"/tricia/mcmillan" should be explicit_group.',
			);
		});

		await t.test("Check existence of nodes in a hierarchy", async (t) => {
			t.ok(await v3.has(h, "/"), 'should have "/".');
			t.ok(await v3.has(h, "/arthur"), 'should have "/arthur".');
			t.ok(await v3.has(h, "/arthur/dent"), 'should have "/arthur/dent".');
			t.notOk(await v3.has(h, "/zaphod"), 'should not have "/zaphod".');
			t.notOk(
				await v3.has(h, "/zaphod/beeblebrox"),
				'should not have "/zaphod/beeblebrox".',
			);
			t.ok(await v3.has(h, "/tricia"), 'should have "/tricia".');
			t.ok(await v3.has(h, "/tricia/mcmillan"), 'should have "/tricia/mcmillan".');
		});

		await t.test("Check existence of children in a group", async (t) => {
			const root = /** @type{v3.ExplicitGroup<any, any>} */ (await v3.get(h));
			t.ok(await v3.has(root, "arthur"), 'root should have "arthur".');
			t.ok(await v3.has(root, "tricia"), 'root should have "tricia".');
			t.notOk(await v3.has(root, "zaphod"), 'root should not have "zaphod".');
			let g = await v3.get_implicit_group(h, "/arthur");
			t.ok(await v3.has(g, "dent"), 'arthur should have "dent".');
			let ig = await v3.get_implicit_group(h, "/tricia");
			t.ok(await v3.has(ig, "mcmillan"), 'tricia should have "mcmillan".');
			t.notOk(
				await v3.has(ig, "beeblebrox"),
				'tricia should not have "breeblebox".',
			);
		});

		await t.test("Read and write array data", async (t) => {
			const a = await v3.get_array(h, "/arthur/dent");
			let res = await get(a, [null, null]);
			t.equal(res.shape, [5, 10], "should have full shape [5, 10].");
			t.deepEqual(
				res.data,
				new Int32Array(50),
				"should be empty typed array (size = 50).",
			);

			res = await get(a, null);
			t.equal(res.shape, [5, 10], "should have full shape [5, 10].");
			t.deepEqual(
				res.data,
				new Int32Array(50),
				"should be empty typed array (size = 50).",
			);

			await set(a, [0, null], 42);
			t.deepEqual(
				(await get(a, null)).data,
				new Int32Array(50).fill(42, 0, 10),
				"should fill 42 in first row.",
			);

			const expected = new Int32Array(50).fill(42, 0, 10);
			[10, 20, 30, 40].forEach((i) => (expected[i] = 42));
			await set(a, [null, 0], 42);
			t.deepEqual(
				(await get(a, null)).data,
				expected,
				"should fill 42 in first row & col.",
			);

			await set(a, null, 42);
			expected.fill(42);
			t.deepEqual(
				(await get(a, null)).data,
				expected,
				"should entirely fill with 42.",
			);

			let arr = ndarray(new Int32Array([...Array(10).keys()]), [10]);
			expected.set(arr.data);
			await set(a, [0, null], arr);
			res = await get(a, null);
			t.deepEqual(res.data, expected, "should fill first row with arange.");

			arr = ndarray(new Int32Array([...Array(50).keys()]), [5, 10]);
			await set(a, null, arr);
			t.deepEqual(
				(await get(a, null)).data,
				arr.data,
				"should fill entire with arange.",
			);

			// Read array slices
			res = await get(a, [null, 0]);
			t.equal(res.shape, [5], "should be vertical column");
			t.deepEqual(
				res.data,
				new Int32Array([0, 10, 20, 30, 40]),
				"should be first column.",
			);

			res = await get(a, [null, 1]);
			t.equal(res.shape, [5], "should be vertical column");
			t.deepEqual(
				res.data,
				new Int32Array([1, 11, 21, 31, 41]),
				"should be second column.",
			);

			res = await get(a, [0, null]);
			t.equal(res.shape, [10], "should be first row.");
			t.deepEqual(
				res.data,
				new Int32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
				"should be first row.",
			);

			res = await get(a, [1, null]);
			t.equal(res.shape, [10], "should be second row.");
			t.deepEqual(
				res.data,
				new Int32Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
				"should be second row.",
			);

			res = await get(a, [null, v3.slice(0, 7)]);
			t.equal(res.shape, [5, 7]);
			// deno-fmt-ignore
			t.deepEqual(res.data, new Int32Array([ 
				 0,  1,  2,  3,  4,
				 5,  6, 10, 11, 12,
				13, 14, 15, 16, 20,
				21, 22, 23, 24, 25,
				26, 30, 31, 32, 33,
				34, 35, 36, 40, 41,
				42, 43, 44, 45, 46,
			]));

			res = await get(a, [v3.slice(0, 3), null]);
			t.equal(res.shape, [3, 10]);
			// deno-fmt-ignore
			t.deepEqual(res.data, new Int32Array([
				 0,  1,  2,  3,  4,  5,  6,  7,  8,  9,
				10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
				20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
			]));
			res = await get(a, [v3.slice(0, 3), v3.slice(0, 7)]);
			t.equal(res.shape, [3, 7]);
			// deno-fmt-ignore
			t.deepEqual(res.data, new Int32Array([
				 0,  1,  2,  3,  4,  5,  6,
				10, 11, 12, 13, 14, 15, 16,
				20, 21, 22, 23, 24, 25, 26,
			]));

			res = await get(a, [v3.slice(1, 4), v3.slice(2, 7)]);
			t.equal(res.shape, [3, 5]);
			// deno-fmt-ignore
			t.deepEqual( res.data, new Int32Array([
				12, 13, 14, 15, 16,
				22, 23, 24, 25, 26,
				32, 33, 34, 35, 36,
			]));

			const b = await v3.get_array(h, "/deep/thought");
			res = await get(b, [v3.slice(10)]);
			t.equal(res.shape, [10]);
			t.deepEqual(res.data, new Float64Array(10));

			expected.fill(1, 0, 5);
			await set(b, [v3.slice(5)], 1);
			t.deepEqual(
				(await get(b, [v3.slice(10)])).data,
				new Float64Array(10).fill(1, 0, 5),
			);
		});
	});
}
