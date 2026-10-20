import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const VENDOR_CHUNKS: Record<string, string> = {
  react: "react-vendor",
  "react-dom": "react-vendor",
  scheduler: "react-vendor",
  "lucide-react": "icons",
  "thinking-orbs": "thinking-orbs",
};

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
  plugins: [react(), tailwindcss()],
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
