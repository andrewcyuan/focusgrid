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
      "@focusgrid/kcc-core": resolve(repoRoot, "packages/kcc-core/src/index.ts"),
      "@focusgrid/kcc-dom": resolve(repoRoot, "packages/kcc-dom/src/index.ts"),
      "@focusgrid/kcc-react": resolve(repoRoot, "packages/kcc-react/src/index.tsx"),
      "react/jsx-dev-runtime": resolve(repoRoot, "packages/focusgrid-react/node_modules/react/jsx-dev-runtime.js"),
      "react/jsx-runtime": resolve(repoRoot, "packages/focusgrid-react/node_modules/react/jsx-runtime.js"),
      "react-dom/server": resolve(repoRoot, "packages/focusgrid-react/node_modules/react-dom/server.node.js"),
      react: resolve(repoRoot, "packages/focusgrid-react/node_modules/react/index.js"),
    },
  },
});
