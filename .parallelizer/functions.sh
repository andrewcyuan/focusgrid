setup_environment() {
  local allocation_number="$1"

  if [ -z "$allocation_number" ]; then
    echo "setup_environment requires a worktree allocation number" >&2
    return 1
  fi

  if [ -n "${PLR_SOURCE_REPO:-}" ] && [ -n "${PLR_WORKTREE:-}" ]; then
    if [ -f "$PLR_SOURCE_REPO/.env" ] && [ ! -f "$PLR_WORKTREE/.env" ]; then
      cp "$PLR_SOURCE_REPO/.env" "$PLR_WORKTREE/.env"
    fi
  fi

  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile
  elif command -v corepack >/dev/null 2>&1; then
    corepack pnpm install --frozen-lockfile
  else
    echo "pnpm is required to set up this workspace" >&2
    return 1
  fi
}
