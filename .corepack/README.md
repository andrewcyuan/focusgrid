# Corepack package-manager cache

This directory is for the offline package-manager tarball used by Codex and
other sandboxed environments.

Generate it from a normal terminal with network access:

```sh
corepack pack pnpm@10.25.0 -o .corepack/pnpm-10.25.0.tgz
```

Commit `.corepack/pnpm-10.25.0.tgz`. Do not commit `.corepack/cache/`.
