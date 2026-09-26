# Focusgrid

Keyboard-driven pane layouts for the web.

- [Focusgrid](packages/focusgrid/README.md): core controller, DOM integration, and React components.
- [Shortcut engine](packages/shortcut-engine/README.md): scoped keyboard sequences.

Run the playground with Bun **1.3.14**:

```sh
bun install --frozen-lockfile
bun run --cwd apps/playground dev
```

The playground uses Ctrl+S, then `|` to split right, `-` to split down, or `x` to close. Ctrl+H/J/K/L moves focus; Ctrl+Shift+H/J/K/L resizes. Drag dividers to resize with the mouse.

Checks:

```sh
bun run test
bun run typecheck
bun run build
bun run --cwd apps/playground e2e
```
