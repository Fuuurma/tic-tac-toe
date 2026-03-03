import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/load/**/*.test.ts"],
    testTimeout: 600000,
    hookTimeout: 120000,
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
