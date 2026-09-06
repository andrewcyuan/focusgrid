import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDirectories = ["shortcut-engine", "focusgrid", "ariakit-adapter"];

function run(command, args, cwd = repoRoot, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: capture ? "pipe" : "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    // Arguments can contain an authentication code.
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
  return result.stdout?.trim();
}

function options(args) {
  const dryRun = args.includes("--dry-run");
  const rest = args.filter((arg) => arg !== "--dry-run");
  if (rest.length === 0) return { dryRun, publishArgs: [] };
  if (rest.length === 2 && rest[0] === "--otp" && /^\d+$/.test(rest[1])) {
    return { dryRun, publishArgs: rest };
  }
  throw new Error("Usage: bun run release [--dry-run] [--otp <code>]");
}

try {
  const { dryRun, publishArgs } = options(process.argv.slice(2));
  run("bun", ["install", "--frozen-lockfile"]);
  for (const script of ["typecheck", "test", "build"]) {
    run("bun", ["run", script]);
  }
  for (const directory of packageDirectories) {
    const cwd = join(repoRoot, "packages", directory);
    const { name, version, private: isPrivate } = JSON.parse(
      readFileSync(join(cwd, "package.json"), "utf8"),
    );
    if (isPrivate) throw new Error(`Refusing to publish private package ${name}`);
    run("bun", [
      "publish", "--access", "public", "--frozen-lockfile",
      "--tolerate-republish", ...(dryRun ? ["--dry-run"] : publishArgs),
    ], cwd);
    if (!dryRun) {
      const tag = `${name}@${version}`;
      if (!run("git", ["tag", "--list", tag], repoRoot, true)) {
        run("git", ["tag", tag]);
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
