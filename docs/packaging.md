# Packaging

Focusgrid uses pnpm workspaces inside this repo and npm package artifacts
outside this repo.

## Local development

Use the pinned wrapper:

```sh
./scripts/pnpm install --frozen-lockfile
./scripts/pnpm -r typecheck
./scripts/pnpm -r test
./scripts/pnpm -r build
```

The repo is a pnpm workspace. Workspace links are only for packages inside this
repo:

- `@focusgrid/focusgrid`
- `@focusgrid/shortcut-engine`
- `@focusgrid/ariakit-adapter`
- `@focusgrid/playground`

External apps must not commit sibling workspace links to this repo. Perilla and
future local projects should consume Focusgrid through the same package artifact
shape that npm consumers receive.

## Package manager pinning

`packageManager` pins `pnpm@10.25.0`. `./scripts/pnpm` runs that version through
Corepack, or from the repo-local `.corepack/cache` when Corepack is unavailable
but the cache has already been installed.

Corepack is not how Focusgrid packages are consumed. It only controls which
package manager version runs the workspace.

## Local consumer testing

Use packed artifacts when testing Focusgrid from another local app before an npm
publish:

```sh
./scripts/pnpm pack:local
```

The command builds the public packages and writes npm tarballs to `.packs/`.
Install those tarballs in a consuming app to test the same package shape npm
users will receive.

This is the only supported local-consumer workflow. Do not use cross-repo pnpm
workspace entries, package aliases, Vite aliases, or source imports from another
application.

Use the dry-run variant to inspect package contents without keeping tarballs:

```sh
./scripts/pnpm pack:dry-run
```

## Publishing

Changesets owns versioning and publish orchestration:

```sh
./scripts/pnpm changeset
./scripts/pnpm version-packages
./scripts/pnpm release
```

`release` runs typecheck, tests, and build before `changeset publish`.

After publish, external apps should depend on semver versions from npm instead
of local tarball paths.

## Turborepo

Focusgrid does not use Turborepo. Turborepo is a task runner and cache layer; it
does not replace pnpm workspaces, Corepack, npm pack, or npm publish. Add it only
if recursive pnpm scripts become too slow and build caching is worth the extra
tooling.
