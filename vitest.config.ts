import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: process.cwd(),
  resolve: {
    alias: {
      "@focusgrid/shortcut-engine": resolve(repoRoot, "packages/shortcut-engine/src/index.ts"),
      "@focusgrid/core": resolve(repoRoot, "packages/focusgrid-core/src/index.ts"),
      "@focusgrid/dom": resolve(repoRoot, "packages/focusgrid-dom/src/index.ts"),
      "@focusgrid/react": resolve(repoRoot, "packages/focusgrid-react/src/index.tsx"),
      "@focusgrid/kcl": resolve(repoRoot, "packages/kcl-core/src/index.ts"),
      "@focusgrid/kcl-dom": resolve(repoRoot, "packages/kcl-dom/src/index.ts"),
      "@focusgrid/kcl-react": resolve(repoRoot, "packages/kcl-react/src/index.tsx"),
      "react/jsx-dev-runtime": resolve(repoRoot, "packages/focusgrid-react/node_modules/react/jsx-dev-runtime.js"),
      "react/jsx-runtime": resolve(repoRoot, "packages/focusgrid-react/node_modules/react/jsx-runtime.js"),
      "react-dom/server": resolve(repoRoot, "packages/focusgrid-react/node_modules/react-dom/server.node.js"),
      react: resolve(repoRoot, "packages/focusgrid-react/node_modules/react/index.js"),
    },
  },
});
