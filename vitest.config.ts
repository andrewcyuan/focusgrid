import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: process.cwd(),
  resolve: {
    alias: {
      "@focusgrid/shortcut-engine": resolve(repoRoot, "packages/shortcut-engine/src/index.ts"),
      "@focusgrid/ariakit-adapter": resolve(repoRoot, "packages/ariakit-adapter/src/index.ts"),
      "@focusgrid/ariakit-adapter/react": resolve(repoRoot, "packages/ariakit-adapter/src/react.ts"),
      "@focusgrid/focusgrid/core": resolve(repoRoot, "packages/focusgrid/core/src/index.ts"),
      "@focusgrid/focusgrid/dom": resolve(repoRoot, "packages/focusgrid/dom/src/index.ts"),
      "@focusgrid/focusgrid/react": resolve(repoRoot, "packages/focusgrid/react/src/index.tsx"),
      "react/jsx-dev-runtime": resolve(repoRoot, "packages/playground/node_modules/react/jsx-dev-runtime.js"),
      "react/jsx-runtime": resolve(repoRoot, "packages/playground/node_modules/react/jsx-runtime.js"),
      "react-dom/server": resolve(repoRoot, "packages/playground/node_modules/react-dom/server.node.js"),
      react: resolve(repoRoot, "packages/playground/node_modules/react/index.js"),
    },
  },
});
