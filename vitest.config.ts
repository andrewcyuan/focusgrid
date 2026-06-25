import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: process.cwd(),
  resolve: {
    alias: {
      "@focusgrid/core": resolve(repoRoot, "packages/focusgrid-core/src/index.ts"),
      "@focusgrid/dom": resolve(repoRoot, "packages/focusgrid-dom/src/index.ts"),
      "@focusgrid/react": resolve(repoRoot, "packages/focusgrid-react/src/index.tsx"),
      "@focusgrid/kcl": resolve(repoRoot, "packages/kcl/src/index.ts"),
      "@focusgrid/kcl-react": resolve(repoRoot, "packages/kcl-react/src/index.tsx"),
    },
  },
});
