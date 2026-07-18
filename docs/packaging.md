# Packaging

Focusgrid uses one package manager workflow for development and one artifact
workflow for consumers.

## Local development

Use the pinned wrapper:

```sh
./scripts/pnpm install --frozen-lockfile
./scripts/pnpm -r typecheck
./scripts/pnpm -r test
./scripts/pnpm -r build
```

The repo is a pnpm workspace. Workspace links are for packages inside this repo:

- `@focusgrid/focusgrid`
- `@focusgrid/shortcut-engine`
- `@focusgrid/ariakit-adapter`
- `@focusgrid/playground`

External apps should not commit sibling workspace links to this repo as their
default dependency model.

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

## Turborepo

Focusgrid does not use Turborepo. Turborepo is a task runner and cache layer; it
does not replace pnpm workspaces, Corepack, npm pack, or npm publish. Add it only
if recursive pnpm scripts become too slow and build caching is worth the extra
tooling.
