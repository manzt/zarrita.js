import MemoryStore from "zarrita/storage/mem";
import { run_test_suite } from "./common.js";

const config = {
	name: "MemoryStore",
	setup: async () => new MemoryStore(),
};

run_test_suite(config);
