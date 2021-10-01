import { MemoryStore } from 'zarrita/storage/mem';
import { run_test_suite } from './common.js';

const config = {
  name: 'MemoryStore',
  setup: async () => {
    const decoder = new TextDecoder();
    const store = new MemoryStore();
    return {
      store,
      get_json: async (key) => {
        const buf = await store.get(key);
        const decoded = decoder.decode(buf);
        return JSON.parse(decoded);
      },
    };
  },
};

run_test_suite(config);
