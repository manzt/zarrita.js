import { test } from 'zora';

import { create_hierarchy, registry, slice } from 'zarrita';
// add dynamic codec to registry
registry.set('gzip', async () => (await import('numcodecs/gzip')).default);

export function run_test_suite({ name, setup }) {
  test(`Zarrita test suite: ${name}.`, async t => {
    const { store, get_json } = await setup();
    const h = await create_hierarchy(store);
    const GZip = await registry.get('gzip')();

    await t.test('Create a hierarchy', async t => {
      t.ok(store, 'created store.');
      t.ok(h, 'created hierarchy.');
    });

    await t.test('Check root json', async t => {
      const m = await get_json('zarr.json');
      t.equal(Object.keys(m).length, 4, 'should have 4 keys.');
      t.equal(m.zarr_format, 'https://purl.org/zarr/spec/protocol/core/3.0', 'should be valid zarr_format url.');
      t.equal(m.metadata_encoding, 'https://purl.org/zarr/spec/protocol/core/3.0', 'correct metadata_encoding.');
      t.equal(m.metadata_key_suffix, '.json', 'should have meta suffix of .json.');
      t.equal(m.extensions, [], 'should have no extensions.');
    });

    await t.test('Create an array', async t => {
      const a = await h.create_array('/arthur/dent', {
        shape: [5, 10],
        dtype: '<i4',
        chunk_shape: [2, 5],
        compressor: new GZip(1),
        attrs: { question: 'life', answer: 42 },
      });
      t.equal(a.repr(), '<Array /arthur/dent>', 'should have repr <Array /arthur/dent>.');
      t.equal(a.path, '/arthur/dent', 'should have path /arthur/dent.');
      t.equal(a.name, 'dent', 'should have name dent.');
      t.equal(a.ndim, 2, 'should have ndim of 2.');
      t.equal(a.shape, [5, 10], 'should have shape: [5, 10].');
      t.equal(a.dtype, '<i4', 'should have dtype <i4.');
      t.equal(a.chunk_shape, [2, 5], 'should have chunk_shape [2, 5].');
      t.ok(a.compressor instanceof GZip, 'should be be instance of GZip compressor.');
      t.equal(a.compressor.level, 1, 'should have gzip compression of 1.');
      t.equal(a.attrs.question, 'life', 'should have question attrs of "life"');
      t.equal(a.attrs.answer, 42, 'should have answer attrs of 42');
    });

    await t.test('Verify /arthur/dent metadata', async t => {
      const m = await get_json('meta/root/arthur/dent.array.json');
      t.equal(m.shape, [5, 10], 'should have shape [5, 10].');
      t.equal(m.data_type, '<i4', 'should have dtype <i4.');
      t.equal(m.chunk_grid.type, 'regular', 'chunk_grid should be regular.');
      t.equal(m.chunk_grid.chunk_shape, [2, 5], 'should have chunk_shape [2, 5].');
      t.equal(m.chunk_grid.separator, '/', 'should have chunk separator of "/".');
      t.equal(m.chunk_memory_layout, 'C', 'should have "C" memory layout.');
      t.equal(m.fill_value, null, 'should have null fill_value.');
      t.equal(m.extensions, [], 'should not have extensions.');
      t.equal(m.attributes.question, 'life', 'should have attributes of question be "life".');
      t.equal(m.attributes.answer, 42, 'should have attributes of answer be 42.');
      t.equal(m.compressor.codec, 'https://purl.org/zarr/spec/codec/gzip/1.0', 'should have correct gzip url.');
      t.equal(m.compressor.configuration.level, 1, 'should have gzip compression level of 1.');
    });

    await t.test('Create an array with no compressor', async t => {
      const a = await h.create_array('/deep/thought', {
        shape: 7500000,
        dtype: '>f8',
        chunk_shape: 42,
        compressor: null,
      });
      t.equal(a.repr(), '<Array /deep/thought>', 'should have repr <Array /deep/thought>.');
      t.equal(a.path, '/deep/thought', 'should have path /deep/thought.');
      t.equal(a.name, 'thought', 'should have name thought.');
      t.equal(a.ndim, 1, 'should have ndim of 1`.');
      t.deepEqual(a.shape, [7500000], 'should have shape: [7500000].');
      t.equal(a.dtype, '>f8', 'should have dtype >f8.');
      t.equal(a.chunk_shape, [42], 'should have chunk_shape [42].');
      t.equal(a.compressor, null, 'should have null compressor.');
      t.equal(a.attrs, {}, 'should have empty attrs.');
    });

    await t.test('Verify /deep/thought metadata', async t => {
      const m = await get_json('meta/root/deep/thought.array.json');
      t.equal(m.shape, [7500000], 'should have shape [7500000].');
      t.equal(m.data_type, '>f8', 'should have dtype >f8.');
      t.equal(m.chunk_grid.type, 'regular', 'chunk_grid should be regular.');
      t.equal(m.chunk_grid.chunk_shape, [42], 'should have chunk_shape [42].');
      t.equal(m.chunk_grid.separator, '/', 'should have chunk separator of "/".');
      t.equal(m.chunk_memory_layout, 'C', 'should have "C" memory layout.');
      t.equal(m.fill_value, null, 'should have null fill_value.');
      t.equal(m.extensions, [], 'should not have extensions.');
      t.equal(m.attributes, {}, 'should have empty attributes.');
      t.ok(m.compressor === undefined, 'should not have compressor.');
    });

    await t.test('Create a group', async t => {
      const g = await h.create_group('/tricia/mcmillan', {
        attrs: { heart: 'gold', improbability: 'infinite' },
      });
      t.equal(g.repr(), '<Group /tricia/mcmillan>', 'should have repr <Group /tricia/mcmillan>.');
      t.equal(g.path, '/tricia/mcmillan', 'should have path /tricia/mcmillan.');
      t.equal(g.name, 'mcmillan', 'should have name mcmillan.');
      t.equal(g.attrs.heart, 'gold', 'should have heart of gold.');
      t.equal(g.attrs.improbability, 'infinite', 'should have inifinite improbability.');
    });

    await t.test('Create nodes via groups', async t => {
      const marvin = await h.create_group('marvin');
      const paranoid = await marvin.create_group('paranoid');
      const android = await marvin.create_array('android', { shape: [42, 42], dtype: '|u1', chunk_shape: [2, 2] });
      t.equal(marvin.repr(), '<Group /marvin>', 'should have repr "<Group /marvin>".');
      t.equal(paranoid.repr(), '<Group /marvin/paranoid>', 'should have repr "<Group /marvin/paranoid>".');
      t.equal(android.repr(), '<Array /marvin/android>', 'should be "<Array /marvin/android>".');
    });

    await t.test('Access an array', async t => {
      const a = await h.get('/arthur/dent');
      t.equal(a.repr(), '<Array /arthur/dent>', 'should have repr "<Array /arthur/dent>".');
      t.equal(a.path, '/arthur/dent', 'should have path /arthur/dent.');
      t.equal(a.name, 'dent', 'should have name dent.');
      t.equal(a.ndim, 2, 'should have ndim of 2.');
      t.equal(a.shape, [5, 10], 'should have shape: [5, 10].');
      t.equal(a.dtype, '<i4', 'should have dtype <i4.');
      t.equal(a.chunk_shape, [2, 5], 'should have chunk_shape [2, 5].');
      t.ok(a.compressor instanceof GZip, 'should be be instance of GZip compressor.');
      t.equal(a.compressor.level, 1, 'should have gzip compression of 1.');
      t.equal(a.attrs.question, 'life', 'should have question attrs of "life"');
      t.equal(a.attrs.answer, 42, 'should have answer attrs of 42');
    });

    await t.test('Access an explicit group', async t => {
      const g = await h.get('/tricia/mcmillan');
      t.equal(g.repr(), '<Group /tricia/mcmillan>', 'should have repr "<Group /tricia/mcmillan>".');
      t.equal(g.attrs.heart, 'gold', 'should have attrs heart of gold.');
      t.equal(g.attrs.improbability, 'infinite', 'should have attrs improbability of infinite.');
    });

    await t.test('Access implicit groups', async t => {
      const root = await h.get('/');
      const arthur = await h.get('/arthur');
      const tricia = await h.get('/tricia');
      t.equal(root.repr(), '<Group / (implied)>', 'should have repr "<Group / (implied)>".');
      t.equal(arthur.repr(), '<Group /arthur (implied)>', 'should have repr "<Group /arthur (implied)>".');
      t.equal(tricia.repr(), '<Group /tricia (implied)>', 'should have repr "<Group /tricia (implied)>".');
    });

    await t.test('Access implicit groups', async t => {
      const root = await h.get('/');
      const arthur = await h.get('/arthur');
      const tricia = await h.get('/tricia');
      t.equal(root.repr(), '<Group / (implied)>', 'should have repr "<Group / (implied)>".');
      t.equal(arthur.repr(), '<Group /arthur (implied)>', 'should have repr "<Group /arthur (implied)>".');
      t.equal(tricia.repr(), '<Group /tricia (implied)>', 'should have repr "<Group /tricia (implied)>".');
    });

    await t.test('Access nodes via groups', async t => {
      const root = await h.get('/');
      const arthur = await root.get('arthur');
      const tricia = await root.get('tricia');
      t.equal(root.repr(), '<Group / (implied)>', 'should have repr "<Group / (implied)>".');
      t.equal(arthur.repr(), '<Group /arthur (implied)>', 'should have repr "<Group /arthur (implied)>".');
      t.equal(tricia.repr(), '<Group /tricia (implied)>', 'should have repr "<Group /tricia (implied)>".');
    });

    await t.test('Access nodes - convenience', async t => {
      t.equal((await h.get('/')).repr(), '<Group / (implied)>', 'should have repr "<Group / (implied)>".');
      t.equal((await h.root).repr(), '<Group / (implied)>', 'should have repr "<Group / (implied)>".');

      t.equal(
        (await h.get('/arthur')).repr(),
        '<Group /arthur (implied)>',
        'should have repr "<Group /arthur (implied)>".'
      );
      t.equal(
        (await h.get('arthur')).repr(),
        '<Group /arthur (implied)>',
        'should have repr "<Group /arthur (implied)>".'
      );
      t.equal(
        (await h.get('/tricia/mcmillan')).repr(),
        '<Group /tricia/mcmillan>',
        'should have repr "<Group /tricia/mcmillan>".'
      );
      const g = await (await h.get('tricia')).get('mcmillan');
      t.equal(g.repr(), '<Group /tricia/mcmillan>', 'should have repr "<Group /tricia/mcmillan>".');
    });

    await t.test('Explore hierarchy top-down', async t => {
      let res = await h.get_children('/');
      t.equal(res.get('arthur'), 'implicit_group', 'arthur should be implicit_group.');
      t.equal(res.get('deep'), 'implicit_group', 'deep should be implicit_group.');
      t.equal(res.get('marvin'), 'explicit_group', 'marvin should be explicit group.');
      t.equal(res.get('tricia'), 'implicit_group', 'tricia should be implicit group.');

      res = await h.get_children('/tricia');
      t.equal(res.get('mcmillan'), 'explicit_group', 'tricia/mcmillan should be explicit group.');

      res = await h.get_children('/tricia');
      t.ok([...res.keys()], 0, 'should be no children for /tricia.');

      res = await h.get_children('/arthur');
      t.equal(res.get('dent'), 'array', 'dent should be an array.');
    });

    await t.test('Alternate way to explore hierarchy', async t => {
      let res = await h.get_children();
      t.equal(res.get('arthur'), 'implicit_group', 'arthur should be implicit_group.');
      t.equal(res.get('deep'), 'implicit_group', 'deep should be implicit_group.');
      t.equal(res.get('marvin'), 'explicit_group', 'marvin should be explicit group.');
      t.equal(res.get('tricia'), 'implicit_group', 'tricia should be implicit group.');

      res = await (await h.get('tricia')).get_children();
      t.equal(res.get('mcmillan'), 'explicit_group', 'tricia/mcmillan should be explicit group.');

      res = await h
        .get('tricia')
        .then(n => n.get('mcmillan'))
        .then(n => n.get_children());
      t.ok([...res.keys()], 0, 'should be no children for /tricia.');

      res = await h.get('arthur').then(n => n.get_children());
      t.equal(res.get('dent'), 'array', 'dent should be an array.');
    });

    await t.test('View the whole hierarchy in one go', async t => {
      const n = await h.get_nodes();
      t.equal([...n.keys()].length, 10, 'should have 10 nodes.');
      t.equal(n.get('/'), 'implicit_group', '"/" should be implicit_group.');
      t.equal(n.get('/arthur'), 'implicit_group', '"/arthur" should be implicit_group.');
      t.equal(n.get('/arthur/dent'), 'array', '"/arthur/dent" should be array.');
      t.equal(n.get('/deep'), 'implicit_group', '"/deep" should be implicit_group.');
      t.equal(n.get('/deep/thought'), 'array', '"/deep/thought" should be array.');
      t.equal(n.get('/marvin'), 'explicit_group', '"/marvin" should be explicit_group.');
      t.equal(n.get('/marvin/android'), 'array', '"/marvin/android" should be array.');
      t.equal(n.get('/marvin/paranoid'), 'explicit_group', '"/marvin/paranoid" should be explicit_group.');
      t.equal(n.get('/tricia'), 'implicit_group', '"/tricia" should be implicit_group.');
      t.equal(n.get('/tricia/mcmillan'), 'explicit_group', '"/tricia/mcmillan" should be explicit_group.');
    });

    await t.test('Check existence of nodes in a hierarchy', async t => {
      t.ok(await h.has('/'), 'should have "/".');
      t.ok(await h.has('/arthur'), 'should have "/arthur".');
      t.ok(await h.has('/arthur/dent'), 'should have "/arthur/dent".');
      t.notOk(await h.has('/zaphod'), 'should not have "/zaphod".');
      t.notOk(await h.has('/zaphod/beeblebrox'), 'should not have "/zaphod/beeblebrox".');
      t.ok(await h.has('/tricia'), 'should have "/tricia".');
      t.ok(await h.has('/tricia/mcmillan'), 'should have "/tricia/mcmillan".');
    });

    await t.test('Check existence of children in a group', async t => {
      const root = await h.root;
      t.ok(await root.has('arthur'), 'root should have "arthur".');
      t.ok(await root.has('tricia'), 'root should have "tricia".');
      t.notOk(await root.has('zaphod'), 'root should not have "zaphod".');
      let g = await h.get('arthur');
      t.ok(await g.has('dent'), 'arthur should have "dent".');
      g = await h.get('tricia');
      t.ok(await g.has('mcmillan'), 'tricia should have "mcmillan".');
      t.notOk(await g.has('beeblebrox'), 'tricia should not have "breeblebox".');
    });

    await t.test('Iterating over a group returns names of all child nodes', async t => {
      const root = await h.get('/');
      let keys = [...(await root.keys())].sort();
      t.equal(keys, ['arthur', 'deep', 'marvin', 'tricia']);

      const arthur = await h.get('arthur');
      keys = [...(await arthur.keys())];
      t.equal(keys, ['dent']);

      const tricia = await h.get('tricia');
      keys = [...(await tricia.keys())];
      t.equal(keys, ['mcmillan']);

      const mcmillan = await h.get('tricia/mcmillan');
      keys = [...(await mcmillan.keys())];
      t.equal(keys, []);

      keys = [...(await h.keys())].sort();
      const root_keys = [
        '/',
        '/arthur',
        '/arthur/dent',
        '/deep',
        '/deep/thought',
        '/marvin',
        '/marvin/android',
        '/marvin/paranoid',
        '/tricia',
        '/tricia/mcmillan',
      ];
      t.equal(keys, root_keys);
    });

    await t.test('Read and write array data', async t => {
      const a = await h.get('/arthur/dent');
      let res = await a.get([null, null]);
      t.equal(res.shape, [5, 10], 'should have full shape [5, 10].');
      t.deepEqual(res.data, new Int32Array(50), 'should be empty typed array (size = 50).');

      res = await a.get(null);
      t.equal(res.shape, [5, 10], 'should have full shape [5, 10].');
      t.deepEqual(res.data, new Int32Array(50), 'should be empty typed array (size = 50).');

      await a.set([0, null], 42);
      t.deepEqual((await a.get(null)).data, new Int32Array(50).fill(42, 0, 10), 'should fill 42 in first row.');

      const expected = new Int32Array(50).fill(42, 0, 10);
      [10, 20, 30, 40].forEach(i => (expected[i] = 42));
      await a.set([null, 0], 42);
      t.deepEqual((await a.get(null)).data, expected, 'should fill 42 in first row & col.');

      await a.set(null, 42);
      expected.fill(42);
      t.deepEqual((await a.get(null)).data, expected, 'should entirely fill with 42.');

      let arr = { data: new Int32Array([...Array(10).keys()]), shape: [10] };
      expected.set(arr.data, 0, arr.data.length);
      await a.set([0, null], arr);
      res = await a.get(null);
      t.deepEqual(res.data, expected, 'should fill first row with arange.');

      arr = { data: new Int32Array([...Array(50).keys()]), shape: [5, 10] };
      await a.set(null, arr);
      t.deepEqual((await a.get(null)).data, arr.data, 'should fill entire with arange.');

      // Read array slices
      res = await a.get([null, 0]);
      t.equal(res.shape, [5], 'should be vertical column');
      t.deepEqual(res.data, new Int32Array([0, 10, 20, 30, 40]), 'should be first column.');

      res = await a.get([null, 1]);
      t.equal(res.shape, [5], 'should be vertical column');
      t.deepEqual(res.data, new Int32Array([1, 11, 21, 31, 41]), 'should be second column.');

      res = await a.get([0, null]);
      t.equal(res.shape, [10], 'should be first row.');
      t.deepEqual(res.data, new Int32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), 'should be first row.');

      res = await a.get([1, null]);
      t.equal(res.shape, [10], 'should be second row.');
      t.deepEqual(res.data, new Int32Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]), 'should be second row.');

      res = await a.get([null, slice(0, 7)]);
      t.equal(res.shape, [5, 7]);
      // prettier-ignore
      t.deepEqual(res.data, new Int32Array([
         0,  1,  2,  3,  4,  5,  6,
        10, 11, 12, 13, 14, 15, 16,
        20, 21, 22, 23, 24, 25, 26,
        30, 31, 32, 33, 34, 35, 36,
        40, 41, 42, 43, 44, 45, 46,
      ]));

      res = await a.get([slice(0, 3), null]);
      t.equal(res.shape, [3, 10]);
      // prettier-ignore
      t.deepEqual(res.data, new Int32Array([
         0,  1,  2,  3,  4,  5,  6,  7,  8,  9,
        10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
     ]));

      res = await a.get([slice(0, 3), slice(0, 7)]);
      t.equal(res.shape, [3, 7]);
      // prettier-ignore
      t.deepEqual(res.data, new Int32Array([
         0,  1,  2,  3,  4,  5,  6,
        10, 11, 12, 13, 14, 15, 16,
        20, 21, 22, 23, 24, 25, 26,
      ]));

      res = await a.get([slice(1, 4), slice(2, 7)]);
      t.equal(res.shape, [3, 5]);
      // prettier-ignore
      t.deepEqual(res.data, new Int32Array([
        12, 13, 14, 15, 16,
        22, 23, 24, 25, 26,
        32, 33, 34, 35, 36,
      ]));

      const b = await h.get('deep/thought');
      res = await b.get([slice(10)]);
      t.equal(res.shape, [10]);
      t.deepEqual(res.data, new Float64Array(10));

      expected.fill(1, 0, 5);
      await b.set([slice(5)], 1);
      t.deepEqual((await b.get([slice(10)])).data, new Float64Array(10).fill(1, 0, 5));
    });
  });
}
