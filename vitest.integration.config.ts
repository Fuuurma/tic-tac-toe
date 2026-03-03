import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
