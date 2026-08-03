import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 3110,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4110,
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
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("scheduler")) {
              return "react-vendor";
            }
            if (id.includes("lucide-react")) {
              return "icons";
            }
            if (id.includes("thinking-orbs")) {
              return "thinking-orbs";
            }
          }
        },
      },
    },
  },
});
