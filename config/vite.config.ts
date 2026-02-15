import { defineConfig } from "vite";

export default defineConfig({
  root: new URL("../web", import.meta.url).pathname,
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: new URL("../web/index.html", import.meta.url).pathname,
        editor: new URL("../web/pages/editor.html", import.meta.url).pathname,
        analysis: new URL("../web/pages/analysis.html", import.meta.url).pathname,
      },
    },
  },
});
