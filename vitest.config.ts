import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: process.cwd(),
  resolve: {
    alias: {
      "@andrewcyuan/shortcut-engine/react": resolve(repoRoot, "packages/shortcut-engine/src/react/index.ts"),
      "@andrewcyuan/shortcut-engine": resolve(repoRoot, "packages/shortcut-engine/src/index.ts"),
      "@andrewcyuan/focusgrid/core": resolve(repoRoot, "packages/focusgrid/core/src/index.ts"),
      "@andrewcyuan/focusgrid/dom": resolve(repoRoot, "packages/focusgrid/dom/src/index.ts"),
      "@andrewcyuan/focusgrid/react": resolve(repoRoot, "packages/focusgrid/react/src/index.tsx"),
      "react/jsx-dev-runtime": resolve(repoRoot, "apps/playground/node_modules/react/jsx-dev-runtime.js"),
      "react/jsx-runtime": resolve(repoRoot, "apps/playground/node_modules/react/jsx-runtime.js"),
      "react-dom/server": resolve(repoRoot, "apps/playground/node_modules/react-dom/server.node.js"),
      react: resolve(repoRoot, "apps/playground/node_modules/react/index.js"),
    },
  },
});
