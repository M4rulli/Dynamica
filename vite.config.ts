import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        landing: new URL("./index.html", import.meta.url).pathname,
        editor: new URL("./editor.html", import.meta.url).pathname,
        analysis: new URL("./analysis.html", import.meta.url).pathname,
      },
    },
  },
});
