# Focusgrid

Focusgrid provides keyboard navigation, resizable pane layouts, and focus management for web apps, with React bindings.

```tsx
import { createDefaultPaneKeymap } from "@andrewcyuan/focusgrid/core";
import {
  FocusGrid, ShortcutProvider, useFocusGridController, useShortcuts,
} from "@andrewcyuan/focusgrid/react";
import { parseKeySequence } from "@andrewcyuan/shortcut-engine";
import "@andrewcyuan/focusgrid/react/styles.css";

function Editor() {
  // Each rendered pane already provides a shortcut scope.
  useShortcuts([
    { sequence: parseKeySequence("Ctrl-S"), action: () => alert("Saved") },
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
- `useFocusGridController(createInitialState, options?)` creates a stable controller; `useControllerState` and `useControllerLayout` subscribe to it. `PaneView` and `ResizeHandle` support custom rendering.
- `createCompositeNavigationKeymap(move)` creates arrow/Home/End callback bindings that ignore editable targets; register them with `useShortcuts` inside a control's scope.
- From `@andrewcyuan/focusgrid/core`, `createFocusGridController` creates a controller without React. State contains a pane/split tree, active pane ID, and container dimensions.
- `controller.api` provides `split`, `wrapRootInSplit`, `remove`, `swap`, `resize`, `resizeHandle`, `focus`, `updatePaneCommandGuards`, `setPaneData`, and `setContainerSize`; `getState`, `getComputedLayout`, `getPaneData`, and `subscribe` expose state.
- `splitActivePane`, `closeActivePane`, `focusAdjacentPane`, `swapAdjacentPane`, and `resizeActivePane` are direct command functions that respect pane capabilities. `createDefaultPaneKeymap(controller)` connects them to default shortcuts; supply your own bindings to change the keys.
- `validateFocusGridControllerState`, `serializeFocusGridControllerState`, and `deserializeFocusGridControllerState` validate, save, and restore layouts.
- From `@andrewcyuan/focusgrid/dom`, `FocusGridDomController(controller, root, { engine, scopeId, parentScopeId, keymap })` registers the grid with a shared engine through `mount()` and `destroy()`; `setKeymap` updates its bindings. Native callers mount the engine separately and register any nested scopes themselves.
