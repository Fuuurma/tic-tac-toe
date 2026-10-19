import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Spike bound: default is one fork per core on a 16 GB Mac shared by
    // many agents (software-factory research/mechanical/2026-10-19-mac-freeze.md).
    maxWorkers: 3,
  },
});
