# Focusgrid

Libraries for building **tmux-like pane layouts in the web**. Fully keyboard-controlled and scriptable using a centralized controller. Plus a shortcut engine + ariakit helpers.

Try some examples in the playground!
```bash
cd packages/playground
bun install --frozen-lockfile
bun run dev
```

__The basic idea__

Similar to `tmux`, Focusgrid represents panes as a binary tree of nodes, enabling intuitive splitting, resize, swapping, and deletion. Each pane has its own render function, allowing you to build whatever you want in the panes. Finally, `tmux` for everything, not just terminals!

```tsx
const keymap = createDefaultPaneKeymap().keymap;

export function App() {
  const controller = useFocusGridController(() => ({
    root: { kind: "pane", id: "main-node", paneId: "main" },
    activePaneId: "main",
    container: { width: 0, height: 0 },
  }));

  return (
    <FocusGrid
      controller={controller}
      keymap={keymap}
      renderPane={({ paneId, controller }) => (
        <button onFocus={() => controller.api.focus(paneId)}>
          Pane {paneId}
        </button>
      )}
    />
  );
}
```

shortcut-engine is an accompanying tool for adding keyboard shortcut listeners to your apps. Shortcuts are represented by easily readable keycodes; for example, "ctrl-shift-s".

```tsx
const router = new KeyRouter<undefined, "save">([
  { sequence: parseKeySequence("Ctrl-S"), action: "save" },
]);

window.addEventListener("keydown", (event) => {
  routeKeyboardEvent(event, router, {
    context: undefined,
    onMatch: ({ action }) => {
      if (action === "save") console.log("Saved");
    },
  });
});
```

Finally, a common use case I found for panes was having list-like collections inside them -- for example, a mail list in an email client, or a file tree in an IDE. For this, I created a small ariakit adapter library that has some helper functions for connecting ariakit's `useCompositeStore` with the shortcut engine.

```tsx
const keymap = createCompositeNavigationKeymap({
  overrides: {
    "move-left": "",
    "move-right": "",
    "move-start": "",
    "move-end": "",
  },
});

export function List() {
  const composite = useCompositeStore({ orientation: "vertical" });
  const { compositeProps } = useCompositeShortcutRouter({
    keymap,
    onMatch: ({ action }) => {
      if (action === "move-up") composite.move(composite.up());
      if (action === "move-down") composite.move(composite.down());
    },
  });

  return (
    <Composite store={composite} {...compositeProps}>
      <CompositeItem>Inbox</CompositeItem>
      <CompositeItem>Archive</CompositeItem>
    </Composite>
  );
}
```

## Packages

- `@focusgrid/focusgrid`: pane layout, DOM behavior, and React bindings through explicit subpaths. You don't have to use focusgrid with react, but that's what I made and tested it with.
- `@focusgrid/shortcut-engine`: key sequence parsing, normalization, and stateful shortcut routing.
- `@focusgrid/ariakit-adapter`: React helpers for routing Focusgrid shortcuts through Ariakit `Composite` roots.

`@focusgrid/focusgrid` intentionally has no root export. Import the layer you need:

```ts
import { createFocusGridController } from "@focusgrid/focusgrid/core";
import { FocusGrid } from "@focusgrid/focusgrid/react";
import "@focusgrid/focusgrid/react/styles.css";
```

## Docs

- Focusgrid: [`docs/focusgrid/usage.md`](docs/focusgrid/usage.md), [`docs/focusgrid/api.md`](docs/focusgrid/api.md), and [`docs/focusgrid/commands.md`](docs/focusgrid/commands.md).
- Shortcut Engine: [`docs/shortcut-engine/usage.md`](docs/shortcut-engine/usage.md) and [`docs/shortcut-engine/api.md`](docs/shortcut-engine/api.md).
- Ariakit Adapter: [`docs/ariakit-adapter/usage.md`](docs/ariakit-adapter/usage.md) [`docs/ariakit-adapter/api.md`](docs/ariakit-adapter/api.md).
- Packaging and local consumer testing: [`docs/packaging.md`](docs/packaging.md).
