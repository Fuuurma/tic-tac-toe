import { describe, expect, it } from "vitest";
import config from "../../vite.config";

/**
 * work:246 — the manualChunks matcher tested `id.includes("react")`, and
 * "lucide-react" contains that substring, so every icon module landed in
 * react-vendor and the dedicated "icons" chunk was unreachable. The fix
 * resolves the real package name after the last node_modules segment
 * (pnpm nests packages under node_modules/.pnpm/.../node_modules/) and
 * compares it exactly.
 */

type ChunkFn = (id: string) => string | undefined;

const manualChunks = (
  config as unknown as {
    build: { rollupOptions: { output: { manualChunks: ChunkFn } } };
  }
).build.rollupOptions.output.manualChunks;

const PNPM = "/app/node_modules/.pnpm";
const FLAT = "/app/node_modules";

describe("manualChunks package matching (work:246)", () => {
  it("routes lucide-react to its own icons chunk, not react-vendor", () => {
    expect(
      manualChunks(
        `${PNPM}/lucide-react@1.25.0/node_modules/lucide-react/dist/esm/icons/x.js`,
      ),
    ).toBe("icons");
    expect(manualChunks(`${FLAT}/lucide-react/dist/esm/icons/o.js`)).toBe(
      "icons",
    );
  });

  it("keeps the actual react packages in react-vendor", () => {
    for (const id of [
      `${FLAT}/react/cjs/react.production.js`,
      `${FLAT}/react/jsx-runtime.js`,
      `${FLAT}/react-dom/client.js`,
      `${PNPM}/react-dom@19.2.8/node_modules/react-dom/index.js`,
      `${PNPM}/scheduler@0.27.0/node_modules/scheduler/index.js`,
    ]) {
      expect(manualChunks(id), id).toBe("react-vendor");
    }
  });

  it("keeps thinking-orbs in its named chunk", () => {
    expect(
      manualChunks(
        `${PNPM}/thinking-orbs@0.1.1/node_modules/thinking-orbs/dist/index.js`,
      ),
    ).toBe("thinking-orbs");
  });

  it("leaves app code and unrelated deps in the default chunk", () => {
    expect(manualChunks("/app/src/main.tsx")).toBeUndefined();
    expect(manualChunks(`${FLAT}/cn/index.js`)).toBeUndefined();
    expect(manualChunks(`${FLAT}/morphicons/dist/index.js`)).toBeUndefined();
    expect(manualChunks(`${FLAT}/lucide/dist/esm/lucide.js`)).toBeUndefined();
  });
});
