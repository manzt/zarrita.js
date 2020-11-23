import fsp from 'fs/promises';
import fs from 'fs';

import FileSystemStore from '../src/fsstore.js';
import { run_test_suite } from './common.js';

const config = {
  name: 'FileSystemStore',
  setup: async () => {
    const file_path = 'test.zr3';
    fs.rmdirSync(file_path, { recursive: true });
    return { 
      store: new FileSystemStore(file_path),
      get_json: async key => {
        const blob = await fsp.readFile(file_path + '/' + key);
        return JSON.parse(blob);
      },
    };
  },
};

run_test_suite(config);
