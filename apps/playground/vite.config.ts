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
        find: "@andrewcyuan/focusgrid/react/styles.css",
        replacement: fileURLToPath(
          new URL("../../packages/focusgrid/react/src/styles.css", import.meta.url),
        ),
      },
      {
        find: "@andrewcyuan/shortcut-engine",
        replacement: fileURLToPath(
          new URL("../../packages/shortcut-engine/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@andrewcyuan/focusgrid/core",
        replacement: fileURLToPath(
          new URL("../../packages/focusgrid/core/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@andrewcyuan/focusgrid/dom",
        replacement: fileURLToPath(
          new URL("../../packages/focusgrid/dom/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@andrewcyuan/focusgrid/react",
        replacement: fileURLToPath(
          new URL("../../packages/focusgrid/react/src/index.tsx", import.meta.url),
        ),
      },
    ],
  },
});
