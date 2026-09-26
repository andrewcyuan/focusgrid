# Focusgrid

Focusgrid provides keyboard navigation, resizable pane layouts, and focus management for web apps, with React bindings.

```tsx
import { createDefaultPaneKeymap } from "@andrewcyuan/focusgrid/core";
import {
  FocusGrid, ShortcutProvider, useFocusGridController, useShortcuts,
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
  const controller = useFocusGridController(() => ({
    root: { kind: "pane", id: "root", paneId: "main" },
    activePaneId: "main",
    container: { width: 800, height: 500 },
  }));
  return (
    <div style={{ height: 500 }}>
      <FocusGrid
        controller={controller}
        keymap={createDefaultPaneKeymap(controller)}
        renderPane={() => <Editor />}
      />
    </div>
  );
}

export function App() {
  return <ShortcutProvider><Workspace /></ShortcutProvider>;
}
```

API overview:

- `ShortcutProvider` owns one engine and document listener. `ShortcutScope` creates a nested scope; `useShortcuts(bindings)` adds callbacks to the nearest scope. Deeper complete matches take priority, so overrides need no separate API.
- `FocusGrid` creates a grid scope and child pane scopes, renders panes and resize handles, and tracks container size; give its parent a height. It accepts `controller`, `renderPane`, optional `keymap`, `onPaneLayoutChange`, `onPaneClose`, and `focusManagement` for application focus restoration.
- `useFocusGridController(createProps)` creates a stable controller; `useControllerState` and `useControllerLayout` subscribe to it. `PaneView` and `ResizeHandle` support custom rendering.
- `createCompositeNavigationKeymap(move)` creates arrow/Home/End callback bindings that ignore editable targets; register them with `useShortcuts` inside a control's scope.
- From `@andrewcyuan/focusgrid/core`, `new FocusGridController(props)` creates a controller without React. Props contain `root`, `activePaneId`, `container`, and optional `minWidth`, `minHeight`, capability `paneDefaults`, and `directionalFocusOverflow`.
- The controller provides direct methods: `split`, `remove`, `swap`, `resize`, `resizeHandle`, `focus`, `updatePane`, and `setContainerSize`; the read-only `state` property exposes the current snapshot, and `subscribe` reports changes. Use `computeLayout(state)` for geometry and `findPaneNode(state.root, paneId)` for pane state.
- `createDefaultPaneKeymap(controller)` connects public controller methods to default shortcuts that respect pane capabilities; supply your own bindings to change the keys.
- `validateFocusGridControllerState` and `deserializeFocusGridControllerState` validate state and restore layouts; save with `JSON.stringify(state)`.
- From `@andrewcyuan/focusgrid/dom`, `FocusGridDomController(controller, root, { engine, scopeId, parentScopeId, keymap })` registers the grid with a shared engine through `mount()` and `destroy()`; `setKeymap` updates its bindings. Native callers use `mountShortcutListener(engine, document)` for focus tracking and one capture listener, and mark nested scope elements with `data-shortcut-scope`.

Split an individual pane by its node ID; other pane methods take its pane ID.
Supplied `newPaneId`, `newPaneNodeId`, and `splitId` are preserved; omitted IDs are generated.
`updatePane(paneId, patch)` changes data, minimum sizes, or command guards without changing pane identity.
Unchanged patches preserve state identity and do not notify subscribers.
React render callbacks and pane components use the same `Pane` type.

```ts
const controller = new FocusGridController({
  root: { kind: "pane", id: "editor-node", paneId: "editor" },
  activePaneId: "editor",
  container: { width: 1000, height: 600 },
  minWidth: 120,
  minHeight: 80,
});
controller.split("editor-node", { side: "right", newPaneId: "terminal" });
controller.updatePane("terminal", { canRemove: false });
```

Core uses one `CardinalDirection` type and `cardinalDirections` list for pane commands. `computeLayout(state)` returns panes, handles, and `rectByNodeId`; controller methods own all state transitions and notifications.

Pane minimum sizes are controller-wide settings, default to zero, and are not stored in serialized pane state. Use `PaneCommandCapability` enum members when selecting capability keys (for example, `controller.updatePane(id, { [PaneCommandCapability.Remove]: false })`).
