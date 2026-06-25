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

## Keyboard Shortcuts

Shortcut chords use `-` between combined keys and spaces between strokes:

```ts
parseKeySequence("Ctrl-b l");
```

Bindings can opt into tmux-style retained leaders with `repeat: true`. After a
repeatable two-stroke sequence such as `Ctrl-b l` runs, pressing another
repeatable follower under the same leader, such as `l` or `h`, within the repeat
window runs that command without replaying `Ctrl-b`.

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

workspace.api.split("main", {
  side: "right",
  newPaneId: "terminal",
});

console.log(workspace.getComputedLayout());
```

## React usage

```tsx
import { createWorkspace } from "@focusgrid/core";
import { PaneProvider, PaneRoot } from "@focusgrid/react";
import type { ComponentType } from "react";
import "@focusgrid/react/styles.css";

function EditorPane() {
  return <textarea defaultValue="Write here..." />;
}

function TerminalPane() {
  return <pre>$ pnpm test</pre>;
}

function EmptyPane({ paneId }: { paneId: string }) {
  return <div>Unknown pane: {paneId}</div>;
}

const panes: Record<string, ComponentType> = {
  editor: EditorPane,
  terminal: TerminalPane,
};

const workspace = createWorkspace({
  root: {
    kind: "split",
    id: "node-1",
    direction: "horizontal",
    sizes: [0.7, 0.3],
    children: [
      {
        kind: "pane",
        id: "node-2",
        paneId: "editor",
      },
      {
        kind: "pane",
        id: "node-3",
        paneId: "terminal",
      },
    ],
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
      <PaneRoot
        renderPane={({ paneId }) => {
          const Component = panes[paneId];
          return Component ? <Component /> : <EmptyPane paneId={paneId} />;
        }}
      />
    </PaneProvider>
  );
}
```
