# Focusgrid

Focusgrid is a pnpm monorepo for a tmux-style, keyboard-focusable pane runtime.

The packages are intentionally layered:

```txt
@focusgrid/core
  Pure TypeScript. Owns state, layout operations, commands, and geometry.

@focusgrid/shortcut-engine
  Pure TypeScript. Owns key parsing, event normalization, and shortcut routing.

@focusgrid/dom
  Browser adapter. Owns KeyboardEvent, PointerEvent, ResizeObserver, and DOM focus behavior.

@focusgrid/react
  Thin React wrapper. Owns context, hooks, refs, and rendering helpers.
```

Core imports shortcut-engine but not DOM or React. DOM imports core and
shortcut-engine. React imports core and DOM.

## Keyboard Shortcuts

Shortcut chords use `-` between combined keys and spaces between strokes:

```ts
import { parseKeySequence } from "@focusgrid/shortcut-engine";

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
import { createFocusGridController } from "@focusgrid/core";

const controller = createFocusGridController({
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

controller.api.split("main", {
  side: "right",
  newPaneId: "terminal",
});

console.log(controller.getComputedLayout());
```

## React usage

```tsx
import { createFocusGridController } from "@focusgrid/core";
import { FocusGrid } from "@focusgrid/react";
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

const controller = createFocusGridController({
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
    <FocusGrid
      controller={controller}
      renderPane={({ paneId }) => {
        const Component = panes[paneId];
        return Component ? <Component /> : <EmptyPane paneId={paneId} />;
      }}
    />
  );
}
```
