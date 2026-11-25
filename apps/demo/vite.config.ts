import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const source = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@andrewcyuan/focusgrid/react/styles.css": source("focusgrid/react/src/styles.css"),
      "@andrewcyuan/focusgrid/core": source("focusgrid/core/src/index.ts"),
      "@andrewcyuan/focusgrid/dom": source("focusgrid/dom/src/index.ts"),
      "@andrewcyuan/focusgrid/react": source("focusgrid/react/src/index.tsx"),
      "@andrewcyuan/shortcut-engine/react": source("shortcut-engine/src/react/index.ts"),
      "@andrewcyuan/shortcut-engine": source("shortcut-engine/src/index.ts"),
    },
  },
});
