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
import { useRef } from "react";
import { createDefaultPaneKeymap } from "@focusgrid/focusgrid/core";
import { FocusGrid, useFocusGridController } from "@focusgrid/focusgrid/react";
import "@focusgrid/focusgrid/react/styles.css";

const keymap = createDefaultPaneKeymap().keymap;

export function App() {
  const applicationRef = useRef<HTMLDivElement>(null);
  const controller = useFocusGridController(() => ({
    root: { kind: "pane", id: "main-node", paneId: "main" },
    activePaneId: "main",
    container: { width: 0, height: 0 },
  }));

  return (
    <div ref={applicationRef} style={{ height: "100dvh" }}>
      <FocusGrid
        controller={controller}
        keymap={keymap}
        focusManagement={{ mode: "application", scopeRef: applicationRef }}
        renderPane={({ paneId }) => <button>Pane {paneId}</button>}
      />
    </div>
  );
}
```

The wrapper gives the grid a nonzero height. This example opts into application
focus management so pane navigation also moves browser focus; see the
[focus policy guide](docs/focusgrid/usage.md#application-focus-management).

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

## Publishing to npm

Use Bun `1.3.14` and Node.js. Run these commands from the repository root.
Sign in with an npm account that can publish to the `@focusgrid` scope:

```sh
npm login
bun pm whoami
bun install --frozen-lockfile
```

For each release, add a changeset and apply the version updates. Skip these
two commands for the first `0.1.0` release, which already has its versions set.

```sh
bun run changeset
bun run version-packages
```

Review and commit the version, changelog, and `bun.lock` changes before publishing.
Preview the packages, then publish and push the release tags:

```sh
bun run release:dry-run
bun run release
git push origin --tags
```

Both release commands check the frozen install, types, tests, and build.
The dry run does not publish or create tags. The release publishes
`@focusgrid/shortcut-engine`, `@focusgrid/focusgrid`, and
`@focusgrid/ariakit-adapter` in that order with public access, then creates
local package tags. It does not bump versions.

If npm requires a one-time password, use `bun run release --otp <code>`.
After a partial failure, rerun the release command; it tolerates versions
that are already published. Verify each release with
`bun info <package>@<version> version`. See [Packaging](docs/packaging.md)
for more details.

## Docs

- Focusgrid: [`docs/focusgrid/usage.md`](docs/focusgrid/usage.md), [`docs/focusgrid/api.md`](docs/focusgrid/api.md), and [`docs/focusgrid/commands.md`](docs/focusgrid/commands.md).
- Shortcut Engine: [`docs/shortcut-engine/usage.md`](docs/shortcut-engine/usage.md) and [`docs/shortcut-engine/api.md`](docs/shortcut-engine/api.md).
- Ariakit Adapter: [`docs/ariakit-adapter/usage.md`](docs/ariakit-adapter/usage.md) [`docs/ariakit-adapter/api.md`](docs/ariakit-adapter/api.md).
- Packaging and local consumer testing: [`docs/packaging.md`](docs/packaging.md).
