import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@focusgrid/react/styles.css",
        replacement: fileURLToPath(new URL("../react/src/styles.css", import.meta.url)),
      },
      {
        find: "@focusgrid/core",
        replacement: fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
      },
      {
        find: "@focusgrid/dom",
        replacement: fileURLToPath(new URL("../dom/src/index.ts", import.meta.url)),
      },
      {
        find: "@focusgrid/react",
        replacement: fileURLToPath(new URL("../react/src/index.tsx", import.meta.url)),
      },
    ],
  },
});
