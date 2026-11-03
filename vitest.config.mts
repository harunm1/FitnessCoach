import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    exclude: [
      ...configDefaults.exclude,
      "tests/integration/**",
      "tests/e2e/**",
    ],
    testTimeout: 15_000,
  },
});
