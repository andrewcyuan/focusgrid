import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:5173",
  },
  webServer: {
    command: "../../scripts/pnpm --filter @focusgrid/playground dev -- --port 5173",
    reuseExistingServer: true,
    timeout: 30_000,
    url: "http://127.0.0.1:5173",
  },
});
