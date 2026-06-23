# Focusgrid

Focusgrid is a pnpm monorepo for a tmux-style, keyboard-focusable pane runtime.

The packages are intentionally layered:

```txt
@focusgrid/core
  Pure TypeScript. Owns state, layout operations, commands, keyboard parsing, and geometry.

@focusgrid/dom
  Browser adapter. Owns KeyboardEvent, PointerEvent, ResizeObserver, and DOM focus behavior.

@focusgrid/react
  Thin React wrapper. Owns context, hooks, refs, and rendering helpers.
```

Core does not import DOM or React. DOM imports core. React imports core and DOM.

## Commands

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Headless usage

```ts
import { createWorkspace } from "@focusgrid/core";

const workspace = createWorkspace({
  root: {
    kind: "pane",
    id: "node-1",
    paneId: "main",
  },
  activePaneId: "main",
  container: {
    width: 1200,
    height: 800,
  },
});

workspace.dispatch({
  type: "pane.split",
  paneId: "main",
  direction: "horizontal",
  newPaneId: "terminal",
});

console.log(workspace.getComputedLayout());
```

## React usage

```tsx
import { createWorkspace } from "@focusgrid/core";
import { PaneProvider, PaneRoot } from "@focusgrid/react";
import "@focusgrid/react/styles.css";

const workspace = createWorkspace({
  root: {
    kind: "pane",
    id: "node-1",
    paneId: "editor",
  },
  activePaneId: "editor",
  container: {
    width: 0,
    height: 0,
  },
});

export function App() {
  return (
    <PaneProvider workspace={workspace}>
      <PaneRoot renderPane={(paneId) => <div>{paneId}</div>} />
    </PaneProvider>
  );
}
```
