# Focusgrid

Focusgrid provides keyboard navigation, resizable pane layouts, and focus management for web apps, with React bindings.

```tsx
import { useState } from "react";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { useShortcuts } from "@andrewcyuan/shortcut-engine/react";
import {
  FocusGrid, useFocusGridController,
} from "@andrewcyuan/focusgrid/react";
import "@andrewcyuan/focusgrid/react/styles.css";

function Editor() {
  // Each rendered pane already provides a shortcut scope.
  useShortcuts([
    { sequence: "ctrl-s", action: () => alert("Saved") },
  ]);
  return <textarea aria-label="Editor" />;
}

function Workspace() {
  const [domController] = useState(() => new FocusGridDomController());
  const controller = useFocusGridController(() => ({
    root: { kind: "pane", id: "root", paneId: "main" },
    activePaneId: "main",
    container: { width: 800, height: 500 },
  }), domController);
  return (
    <div style={{ height: 500 }}>
      <FocusGrid
        controller={controller}
        domController={domController}
        renderPane={() => <Editor />}
      />
    </div>
  );
}

export function App() {
  return <Workspace />;
}
```

API overview:

- Import `ShortcutScope` and `useShortcuts` from `@andrewcyuan/shortcut-engine/react`. No provider is required. Deeper complete matches take priority.
- `FocusGrid` creates a grid scope and child pane scopes, registers default shortcuts, renders panes and resize handles, and tracks container size. Give its parent a height. Pass `controller`, the same `domController` injected into core, and `renderPane`; optional props include `keymap`, `onPaneLayoutChange`, and `onPaneClose`. A supplied keymap replaces the defaults, including an empty array.
- `useFocusGridController(createProps, domController)` creates a stable controller.
- `createCompositeNavigationKeymap(move)` creates arrow/Home/End callback bindings that ignore editable targets; register them with `useShortcuts` inside a control's scope.
- From `@andrewcyuan/focusgrid/core`, `new FocusGridController(props, domController)` creates a controller without React. Props contain `root`, `activePaneId`, `container`, and optional `minWidth`, `minHeight`, capability `paneDefaults`, and `directionalFocusOverflow`.
- The controller provides direct methods: `split`, `remove`, `swap`, `resize`, `resizeHandle`, `focus`, `updatePane`, and `setContainerSize`; `subscribe` reports committed changes. Controller state is private; shortcut actions use `splitActive`, `removeActive`, `focusAdjacent`, `swapAdjacent`, and `resizeActive`.
- From `@andrewcyuan/focusgrid/react`, `createDefaultPaneKeymap(controller)` connects public controller methods to default shortcuts that respect pane capabilities; supply your own bindings to change the keys.
- `validateFocusGridControllerState` validates initial controller input.
- From `@andrewcyuan/focusgrid/dom`, `new FocusGridDomController()` implements core's `DomController` interface: `focus(paneId): boolean`. Attach the renderer with `setRoot(root)` and clear it with `setRoot(null)`. Roots use `.FocusgridFocusGrid`; pane shells use `data-pane-id` and `tabIndex={-1}`. Lookups exclude nested grids. Focus inside the target pane is preserved; otherwise its shell receives focus with `preventScroll`.
- `focusAdjacent(direction)` requests DOM focus before updating active-pane state and returns false if focus fails. `focus(paneId)` only synchronizes core state from DOM focus and never requests DOM focus itself.
- Consuming apps own background clicks, window activation, and remembered-focus restoration. Focusgrid has no application focus manager.

`useControllerLayout(controller)` subscribes to `controller.getLayout()`, which returns computed panes, handles, and geometry with stable identity until the next committed change. It exposes no raw layout tree. Treat the computed layout as read-only.

For imperative queries, `getPane(paneId)` returns a copy of a pane's IDs and capabilities, `getContainerSize()` returns copied dimensions, and `getSplitSizes(splitId)` returns copied ratios for a drag baseline. Missing panes and splits return `null`. Use command methods such as `focusAdjacent()` for navigation rather than reading layout to select a target.

Split an individual pane by its node ID; other pane methods take its pane ID.
Supplied `newPaneId`, `newPaneNodeId`, and `splitId` are preserved; omitted IDs are generated.
`updatePane(paneId, patch)` changes pane capabilities without changing pane identity.
Unchanged patches preserve state identity and do not notify subscribers.
React render callbacks and pane components use the same `Pane` type.

```ts
const domController = new FocusGridDomController();
const controller = new FocusGridController({
  root: { kind: "pane", id: "editor-node", paneId: "editor" },
  activePaneId: "editor",
  container: { width: 1000, height: 600 },
  minWidth: 120,
  minHeight: 80,
}, domController);
controller.split("editor-node", { side: "right", newPaneId: "terminal" });
controller.updatePane("terminal", { canRemove: false });
```

Core uses one `CardinalDirection` type and `cardinalDirections` list for pane commands. `controller.getLayout()` returns panes, handles, and `rectByNodeId`; controller methods own all state transitions and notifications.

Pane minimum sizes are controller-wide settings, default to zero, and are not stored in serialized pane state. Use `PaneCommandCapability` enum members when selecting capability keys (for example, `controller.updatePane(id, { [PaneCommandCapability.Remove]: false })`).
