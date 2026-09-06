# Packaging

Use Bun `1.3.14` directly. The root `packageManager` field records the required
version; install that version before working in this repo. Node.js is also
required by the existing build and test tools.

## Development

Run from the repository root:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
bun run lint
bun run --filter @focusgrid/playground dev
bun run --filter @focusgrid/playground e2e
```

Use `bun run test`, which runs Vitest. `bun test` selects Bun's own test runner.
The root `workspaces` field includes `packages/*`. Internal dependencies keep
`workspace:*`; Bun converts these to concrete versions when publishing.
Commit `bun.lock` and use frozen installs for repeatable builds.

## Consumers

External apps, including Perilla, must install released semver versions from
the npm registry. Do not use sibling workspace entries, package aliases,
Vite aliases, or source imports from this repository.

```sh
bun add @focusgrid/focusgrid
# For direct shortcut engine or Ariakit adapter use:
bun add @focusgrid/shortcut-engine @focusgrid/ariakit-adapter @ariakit/react
```

## Versions and releases

Changesets manages independent package versions and changelogs:

```sh
bun run changeset
bun run version-packages
```

The version command also updates `bun.lock`. Review and commit the version,
changelog, and lockfile changes before publishing. For the first `0.1.0`
release, keep the existing versions and skip these two commands.

Authenticate to npm with an account that can publish to the `@focusgrid` scope
(for example, with `npm login`), then verify it with `bun pm whoami`.

```sh
bun run release:dry-run
bun run release
git push origin --tags
```

Both release commands verify a frozen install, typecheck, test, and build.
Bun publishes the shortcut engine first, then Focusgrid, then the Ariakit
adapter, all with public access. The root and playground stay private.
The dry run previews package contents without publishing or creating tags.

If needed, pass a one-time password with `bun run release --otp <code>`.
After a partial failure, rerun the release command: Bun tolerates already
published versions. Successful packages receive local Git tags of the form
`@focusgrid/focusgrid@0.1.0`; existing tags are left intact. Tags are not pushed
automatically. Publication does not bump versions.

Verify each released version with `bun info <package>@<version> version`.
