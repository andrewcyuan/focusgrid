import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pnpm = join(repoRoot, "scripts", "pnpm");
const publicPackages = [
  "@focusgrid/shortcut-engine",
  "@focusgrid/focusgrid",
  "@focusgrid/ariakit-adapter",
];

const mode = process.argv[2];

if (mode !== "--dry-run" && mode !== "--local") {
  console.error("Usage: node scripts/pack.mjs --dry-run|--local");
  process.exit(1);
}

const outputDir =
  mode === "--local"
    ? join(repoRoot, ".packs")
    : mkdtempSync(join(tmpdir(), "focusgrid-pack-"));

let exitCode = 0;

try {
  if (mode === "--local") {
    rmSync(outputDir, { force: true, recursive: true });
    mkdirSync(outputDir, { recursive: true });
  }

  run([pnpm, "build"]);

  for (const packageName of publicPackages) {
    run([
      pnpm,
      "--filter",
      packageName,
      "pack",
      "--json",
      "--pack-destination",
      outputDir,
    ]);
  }
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  if (mode === "--dry-run") {
    rmSync(outputDir, { force: true, recursive: true });
  }
}

process.exit(exitCode);

function run([command, ...args]) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "true",
    },
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}
