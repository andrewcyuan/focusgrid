import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function simulate(args, fail = "") {
  const root = mkdtempSync(join(tmpdir(), "focusgrid-release-test-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "bin"));
    copyFileSync(new URL("../scripts/release.mjs", import.meta.url), join(root, "scripts/release.mjs"));
    for (const name of ["shortcut-engine", "focusgrid", "ariakit-adapter"]) {
      const dir = join(root, "packages", name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `@focusgrid/${name}`, version: "0.1.0" }));
    }
    const fakeCli = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.RELEASE_LOG, JSON.stringify({ command: require("node:path").basename(process.argv[1]), args, cwd: process.cwd() }) + "\\n");
if (process.env.RELEASE_FAIL && args.includes(process.env.RELEASE_FAIL)) process.exit(1);
`;
    for (const name of ["bun", "git"]) {
      writeFileSync(join(root, "bin", name), fakeCli, { mode: 0o755 });
    }
    const log = join(root, "calls.jsonl");
    writeFileSync(log, "");
    const result = spawnSync(process.execPath, [join(root, "scripts/release.mjs"), ...args], {
      env: { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`, RELEASE_LOG: log, RELEASE_FAIL: fail },
      encoding: "utf8",
    });
    return { ...result, calls: readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("dry run previews packages in dependency order and never tags", () => {
  const result = simulate(["--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  const publishes = result.calls.filter(({ args }) => args[0] === "publish");
  assert.deepEqual(publishes.map(({ cwd }) => cwd.split("/").at(-1)), ["shortcut-engine", "focusgrid", "ariakit-adapter"]);
  assert.ok(publishes.every(({ args }) => args.includes("--dry-run")));
  assert.ok(result.calls.every(({ command }) => command !== "git"));
});

test("failed checks prevent all publication and tagging", () => {
  const result = simulate([], "test");
  assert.equal(result.status, 1);
  assert.ok(result.calls.every(({ args, command }) => args[0] !== "publish" && command !== "git"));
});

test("failed publication does not tag or continue", () => {
  const result = simulate([], "publish");
  assert.equal(result.status, 1);
  assert.equal(result.calls.filter(({ args }) => args[0] === "publish").length, 1);
  assert.ok(result.calls.every(({ command }) => command !== "git"));
});

test("successful publication forwards OTP and creates package tags", () => {
  const result = simulate(["--otp", "123456"]);
  assert.equal(result.status, 0, result.stderr);
  const publishes = result.calls.filter(({ args }) => args[0] === "publish");
  assert.ok(publishes.every(({ args }) => args.includes("--tolerate-republish") && args.at(-1) === "123456"));
  assert.equal(result.calls.filter(({ command, args }) => command === "git" && args.length === 2).length, 3);
});
