import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const sourceRoot = path.resolve(__dirname, "src");

export default defineConfig({
  main: {
    resolve: {
      alias: {
        "@pr-rosey/desktop": sourceRoot,
      },
    },
  },
  preload: {
    resolve: {
      alias: {
        "@pr-rosey/desktop": sourceRoot,
      },
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: "[name].cjs",
          format: "cjs",
        },
      },
    },
  },
  renderer: {
    root: ".",
    plugins: [react()],
    resolve: {
      alias: {
        "@pr-rosey/desktop": sourceRoot,
      },
    },
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, "index.html"),
      },
    },
  },
});
