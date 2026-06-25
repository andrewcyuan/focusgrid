import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "react/jsx-runtime",
        replacement: fileURLToPath(
          new URL("./node_modules/react/jsx-runtime.js", import.meta.url),
        ),
      },
      {
        find: "react/jsx-dev-runtime",
        replacement: fileURLToPath(
          new URL("./node_modules/react/jsx-dev-runtime.js", import.meta.url),
        ),
      },
      {
        find: "react",
        replacement: fileURLToPath(
          new URL("./node_modules/react/index.js", import.meta.url),
        ),
      },
      {
        find: "@focusgrid/react/styles.css",
        replacement: fileURLToPath(
          new URL("../focusgrid-react/src/styles.css", import.meta.url),
        ),
      },
      {
        find: "@focusgrid/shortcut-engine",
        replacement: fileURLToPath(
          new URL("../shortcut-engine/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@focusgrid/core",
        replacement: fileURLToPath(
          new URL("../focusgrid-core/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@focusgrid/dom",
        replacement: fileURLToPath(
          new URL("../focusgrid-dom/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@focusgrid/react",
        replacement: fileURLToPath(
          new URL("../focusgrid-react/src/index.tsx", import.meta.url),
        ),
      },
      {
        find: "@focusgrid/kcl",
        replacement: fileURLToPath(
          new URL("../kcl-core/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@focusgrid/kcl-dom",
        replacement: fileURLToPath(
          new URL("../kcl-dom/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@focusgrid/kcl-react",
        replacement: fileURLToPath(
          new URL("../kcl-react/src/index.tsx", import.meta.url),
        ),
      },
    ],
  },
});
