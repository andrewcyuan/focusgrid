import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDirectories = ["shortcut-engine", "focusgrid"];

function readPackageJson(directory) {
  return JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
}

function assertLockfileMatchesPackageVersions() {
  const raw = readFileSync(join(repoRoot, "bun.lock"), "utf8");
  // bun.lock is JSONC — trailing commas are allowed and must be stripped before JSON.parse.
  const lockfile = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1"));
  const workspaces = lockfile.workspaces ?? {};
  for (const directory of packageDirectories) {
    const key = `packages/${directory}`;
    const lockEntry = workspaces[key];
    const pkg = readPackageJson(join(repoRoot, "packages", directory));
    if (!lockEntry) throw new Error(`bun.lock is missing workspace entry for ${key}.`);
    if (lockEntry.version !== pkg.version) {
      throw new Error(
        `bun.lock lists ${pkg.name} at ${lockEntry.version}, but packages/${directory}/package.json is ${pkg.version}. ` +
          `Delete bun.lock and run 'bun install' so 'workspace:*' resolves to ${pkg.version} on publish.`,
      );
    }
  }
}

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
  // Bun does not prune orphaned packages from node_modules/.bun on install,
  // which lets stale type declarations (e.g. duplicate csstype) break typecheck.
  // Force a clean install so the release runs against exactly the lockfile.
  rmSync(join(repoRoot, "node_modules"), { recursive: true, force: true });
  run("bun", ["install", "--frozen-lockfile"]);
  assertLockfileMatchesPackageVersions();
  for (const script of ["typecheck", "test", "build"]) {
    run("bun", ["run", script]);
  }
  for (const directory of packageDirectories) {
    const cwd = join(repoRoot, "packages", directory);
    const { name, version, private: isPrivate } = readPackageJson(cwd);
    if (isPrivate) throw new Error(`Refusing to publish private package ${name}`);
    run(
      "bun",
      [
        "publish",
        "--access",
        "public",
        "--frozen-lockfile",
        "--tolerate-republish",
        ...(dryRun ? ["--dry-run"] : publishArgs),
      ],
      cwd,
    );
    if (!dryRun) {
      const tag = `${name}@${version}`;
      const latest = run("npm", ["view", `${name}@latest`, "version"], cwd, true);
      if (latest !== version) run("npm", ["dist-tag", "add", tag, "latest"], cwd);
      if (!run("git", ["tag", "--list", tag], repoRoot, true)) {
        run("git", ["tag", tag]);
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
