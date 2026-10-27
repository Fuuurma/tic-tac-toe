import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// An inherited NODE_ENV=production makes react-dom resolve its production
// build — no React.act — and reds every component suite while the code is
// fine. Measured 2026-10-27: 32 files / 221 tests failing with
// `TypeError: React.act is not a function`, on a tree that passes 779/779
// under NODE_ENV=test. The test layer always runs as `test`, whatever the
// ambient environment says. Pinned by src/__tests__/testEnv.test.ts, which
// runs this suite with the hostile value inherited.
process.env.NODE_ENV = "test";

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
