import tintype from "tintype/plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tintype()],
	test: {
		api: true,
		setupFiles: ["tintype/setup"],
		include: ["packages/**/__tests__/**/*.test.ts"],
	},
});
