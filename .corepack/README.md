# Corepack package-manager cache

This directory is for the offline package-manager tarball used by Codex and
other sandboxed environments.

Generate it from a normal terminal with network access:

```sh
corepack pack pnpm@10.25.0 -o .corepack/pnpm-10.25.0.tgz
```

Commit `.corepack/pnpm-10.25.0.tgz`. Do not commit `.corepack/cache/`.

`./scripts/pnpm` uses Corepack when it is available. If Corepack is missing but
the repo-local cache already exists, the wrapper runs the pinned pnpm CLI from
`.corepack/cache/v1/pnpm/10.25.0/bin/pnpm.cjs`.
