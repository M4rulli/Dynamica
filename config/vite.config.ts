import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: "/index.html",
        editor: "/pages/editor.html",
        analysis: "/pages/analysis.html",
      },
    },
  },
});
