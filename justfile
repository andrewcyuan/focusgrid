demo:
    bun run --cwd apps/demo dev

prepare-and-release:
    @test -z "$(git status --porcelain)" || { echo "Working tree is not clean. Commit or stash first."; exit 1; }
    bun changeset
    bun run version-packages
    rm -f bun.lock && bun install
    git add -A
    git commit -m "release: version packages"
    bun run release:dry-run
    bun run release
