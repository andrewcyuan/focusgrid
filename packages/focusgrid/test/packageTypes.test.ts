import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

beforeAll(() => {
  for (const directory of ["shortcut-engine", "focusgrid"]) {
    execFileSync("bun", ["run", "build"], { cwd: join(repoRoot, "packages", directory), stdio: "pipe" });
  }
}, 60_000);

it.each([
  { module: "ESNext", moduleResolution: "Bundler", extension: "ts" },
  { module: "NodeNext", moduleResolution: "NodeNext", extension: "mts" },
  { module: "NodeNext", moduleResolution: "NodeNext", extension: "cts" },
])("shares controller types across published entry points ($moduleResolution, .$extension)", ({ module, moduleResolution, extension }) => {
  const directory = mkdtempSync(join(tmpdir(), "focusgridConsumer"));
  try {
    mkdirSync(join(directory, "node_modules", "@andrewcyuan"), { recursive: true });
    symlinkSync(packageRoot, join(directory, "node_modules", "@andrewcyuan", "focusgrid"), "dir");
    symlinkSync(join(repoRoot, "node_modules", "@types"), join(directory, "node_modules", "@types"), "dir");
    // No workspace aliases: resolve the same declarations an npm consumer receives.
    writeFileSync(join(directory, "tsconfig.json"), JSON.stringify({
      compilerOptions: { module, moduleResolution, target: "ES2022", lib: ["ES2022", "DOM", "DOM.Iterable"], strict: true, noEmit: true, types: [] },
      include: [`consumer.${extension}`],
    }));
    writeFileSync(join(directory, `consumer.${extension}`), `
import type { ContextType } from "react";
import { FocusGridController, type FocusGridControllerProps } from "@andrewcyuan/focusgrid/core";
import { FocusGridDomController, mountFocusGrid } from "@andrewcyuan/focusgrid/dom";
import { FocusgridController, useControllerLayout, useFocusGridController, type Pane } from "@andrewcyuan/focusgrid/react";

declare const props: FocusGridControllerProps;
const domController = new FocusGridDomController();
const controller = new FocusGridController(props, domController);
const context: NonNullable<ContextType<typeof FocusgridController>> = { controller, domController };
const fromHook: FocusGridController = useFocusGridController(() => props, domController);
const pane: Pane = { paneId: "editor", rect: { x: 0, y: 0, width: 100, height: 100 }, active: true, controller };
useControllerLayout(controller);
mountFocusGrid(document.createElement("div"), controller, domController);
`);
    const result = spawnSync(join(repoRoot, "node_modules", ".bin", "tsc"), ["--project", join(directory, "tsconfig.json"), "--pretty", "false"], { encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.stdout + result.stderr).toBe("");
    expect(result.status).toBe(0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
