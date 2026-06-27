#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACK_DEST="${1:-/tmp/focusgrid-tarballs}"

mkdir -p "$PACK_DEST"
cd "$ROOT_DIR"

pnpm build
pnpm --filter @focusgrid/shortcut-engine pack --pack-destination "$PACK_DEST"
pnpm --filter @focusgrid/core pack --pack-destination "$PACK_DEST"
pnpm --filter @focusgrid/dom pack --pack-destination "$PACK_DEST"
pnpm --filter @focusgrid/react pack --pack-destination "$PACK_DEST"
pnpm --filter @focusgrid/kcl pack --pack-destination "$PACK_DEST"
pnpm --filter @focusgrid/kcl-dom pack --pack-destination "$PACK_DEST"
pnpm --filter @focusgrid/kcl-react pack --pack-destination "$PACK_DEST"

printf '\nPacked Focusgrid tarballs into %s\n' "$PACK_DEST"
