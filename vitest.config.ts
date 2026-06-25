import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: process.cwd(),
  resolve: {
    alias: {
      "@focusgrid/core": resolve(repoRoot, "packages/core/src/index.ts"),
      "@focusgrid/dom": resolve(repoRoot, "packages/dom/src/index.ts"),
      "@focusgrid/react": resolve(repoRoot, "packages/react/src/index.tsx"),
    },
  },
});
