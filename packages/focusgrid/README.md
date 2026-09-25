# Focusgrid

Focusgrid provides keyboard navigation, resizable pane layouts, and focus management for web apps, with React bindings.

```tsx
import { FocusGrid, useFocusGridController } from "@andrewcyuan/focusgrid/react";
import "@andrewcyuan/focusgrid/react/styles.css";

export function Workspace() {
  const controller = useFocusGridController(() => ({
    root: { kind: "pane", id: "root", paneId: "main" },
    activePaneId: "main",
    container: { width: 800, height: 500 },
  }));

  return (
    <div style={{ height: 500 }}>
      <FocusGrid
        controller={controller}
        renderPane={({ paneId }) => (
          <button onClick={() => controller.api.split(paneId, { side: "right" })}>
            Split pane
          </button>
        )}
      />
    </div>
  );
}
```

API overview:

- `@andrewcyuan/focusgrid/react`: `FocusGrid` renders panes and resize handles, tracks container size, and connects keyboard and focus handling; give its parent a height.
- `useFocusGridController(createInitialState, options?)` creates a stable controller; `useControllerState(controller)` and `useControllerLayout(controller)` subscribe to its state and computed layout.
- `FocusGrid` accepts `controller`, `renderPane`, an optional `keymap`, lifecycle callbacks (`onPaneLayoutChange`, `onPaneClose`), and application focus management through `focusManagement`.
- `PaneView` and `ResizeHandle` support custom rendering; `useCompositeShortcutRouter` and `createCompositeNavigationKeymap` add shortcuts within composite widgets.
- `@andrewcyuan/focusgrid/core`: `createFocusGridController(initialState, options?)` creates a controller without React; state contains a pane/split tree, the active pane ID, and container dimensions.
- `controller.api` provides `split`, `wrapRootInSplit`, `remove`, `swap`, `resize`, `resizeHandle`, `focus`, `updatePaneCommandGuards`, `setPaneData`, and `setContainerSize`.
- `controller.getState()`, `getComputedLayout()`, `getPaneData(paneId)`, and `subscribe(listener)` expose state; `controller.commands.register(...)` and `.run(...)` extend or execute commands.
- `createDefaultPaneKeymap` configures pane shortcuts; `validateFocusGridControllerState`, `serializeFocusGridControllerState`, and `deserializeFocusGridControllerState` validate, save, and restore state.
- `@andrewcyuan/focusgrid/dom`: `FocusGridDomController` connects a controller to a DOM root through `mount()` and `destroy()`; `KeyboardListener`, `PointerResizeController`, and `RootResizeObserver` provide lower-level controls.
