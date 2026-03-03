import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/game/logic/**/*.ts"],
    },
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});