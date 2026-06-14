import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/desktop/src"),
    },
  },
  test: {
    include: ["apps/desktop/src/**/*.{test,spec}.{ts,tsx}", "packages/*/src/**/*.{test,spec}.ts"],
  },
});
