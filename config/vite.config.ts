import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  root: "web",
  base: command === "build" ? "/Dynamica/" : "/",
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
}));
