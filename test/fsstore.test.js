// @ts-check
import * as fs from 'node:fs';

import FileSystemStore from 'zarrita/storage/fs';
import { run_test_suite } from './common.js';

const config = {
  name: 'FileSystemStore',
  setup: async () => {
    const file_path = 'test.zr3';
    fs.rmdirSync(file_path, { recursive: true });
    return {
      store: new FileSystemStore(file_path),
      get_json: async (/** @type {string} */ key) => {
        const blob = await fs.promises.readFile(file_path + '/' + key, { encoding: 'utf-8' });
        return JSON.parse(blob);
      },
    };
  },
};

run_test_suite(config);
