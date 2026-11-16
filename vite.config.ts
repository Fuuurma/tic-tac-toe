import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const VENDOR_CHUNKS: Record<string, string> = {
  react: "react-vendor",
  "react-dom": "react-vendor",
  scheduler: "react-vendor",
  "lucide-react": "icons",
  "thinking-orbs": "thinking-orbs",
};

const SW_TEMPLATE_PATH = path.resolve(__dirname, "scripts/service-worker.js");
const SW_PRECACHE_MARKER =
  '/*__PRECACHE_MANIFEST__*/ { cache: "ttt-shell-dev", urls: [] }';
// Pages consumes these as config; they are not app resources to precache.
const SW_IGNORED_FILES = new Set(["_headers", "_redirects", "sw.js"]);

function walkStaticFiles(root: string, prefix: string, out: Map<string, number>): void {
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkStaticFiles(full, `${prefix}${entry.name}/`, out);
    } else if (!SW_IGNORED_FILES.has(entry.name)) {
      out.set(`/${prefix}${entry.name}`, statSync(full).size);
    }
  }
}

/* Emits dist/sw.js: the hand-written worker in scripts/service-worker.js
 * with its precache manifest replaced by every URL the build can serve —
 * bundle output under dist/ plus the static files Vite copies verbatim from
 * public/ (walked from the source because the copy can land after plugin
 * closeBundle hooks; deduped by URL either way). The cache name hashes the
 * file list so a new deploy gets a fresh shell cache and activate can drop
 * the old one without ever serving a shell whose chunks are gone. */
function pwaServiceWorker(): Plugin {
  return {
    name: "ttt:pwa-service-worker",
    apply: "build",
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      const files = new Map<string, number>();
      walkStaticFiles(distDir, "", files);
      walkStaticFiles(path.resolve(__dirname, "public"), "", files);

      const version = createHash("sha256")
        .update([...files.entries()].map(([url, size]) => `${url}:${size}`).join("\n"))
        .digest("hex")
        .slice(0, 12);

      const template = readFileSync(SW_TEMPLATE_PATH, "utf8");
      if (!template.includes(SW_PRECACHE_MARKER)) {
        throw new Error("scripts/service-worker.js lost its __PRECACHE_MANIFEST__ marker");
      }
      writeFileSync(
        path.join(distDir, "sw.js"),
        template.replace(
          SW_PRECACHE_MARKER,
          JSON.stringify({
            cache: `ttt-shell-${version}`,
            urls: [...files.keys()],
          }),
        ),
      );
    },
  };
}

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 3110,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 3110,
    strictPort: true,
  },
  plugins: [react(), tailwindcss(), pwaServiceWorker()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Match the real package name after the last node_modules
          // segment — a substring test on the path swallowed
          // lucide-react into react-vendor and left the icons chunk
          // unreachable. pnpm nests the package dir under
          // node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/.
          const match = /.*node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(id);
          if (!match) return;
          const vendor = VENDOR_CHUNKS[match[1]];
          if (vendor) return vendor;
        },
      },
    },
  },
});
