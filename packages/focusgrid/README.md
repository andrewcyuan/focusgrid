# Focusgrid

Resizable panes with keyboard navigation. Core owns layout and commands; DOM handles focus and resizing; React renders the computed tree.

```tsx
import { useState } from "react";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import {
  FocusGrid, FocusgridController, useFocusGridController,
} from "@andrewcyuan/focusgrid/react";
import "@andrewcyuan/focusgrid/react/styles.css";

export function App() {
  const [domController] = useState(() => new FocusGridDomController());
  const controller = useFocusGridController(() => ({
    root: { kind: "pane", id: "root", paneId: "editor" },
    activePaneId: "editor",
    container: { width: 0, height: 0 },
  }), domController);

  return (
    <FocusgridController.Provider value={{ controller, domController }}>
      <div style={{ height: 500 }}>
        <FocusGrid renderPane={({ paneId }) => <textarea aria-label={paneId} />} />
      </div>
    </FocusgridController.Provider>
  );
}
```

Give the grid's parent a height. An optional `keymap` replaces the default bindings, including when empty.

Default shortcuts: Ctrl+B, then `%` / `"` to split, `x` to close, arrows to focus, Shift+arrows to swap, or H/J/K/L to resize. The [playground](../../apps/playground/src/keymap.ts) uses its own tmux bindings.

Use controller commands: `splitActive`, `removeActive`, `focusAdjacent`, `swapAdjacent`, and `resizeActive`. `focus(paneId)` only syncs active-pane state; `focusAdjacent(direction)` also requests DOM focus. Apps own editor focus restoration and window activation.

Read layout with `getLayout()` or React's `useControllerLayout(controller)`; treat it as read-only. Use `getPane`, `getContainerSize`, and `getSplitSizes` for specific queries, and `subscribe` for changes.

Without React, construct `FocusGridController(props, domController)` from `/core` and attach your renderer with `mountFocusGrid(root, controller, domController)` from `/dom`; it returns cleanup. Core requires only `domController.focus(paneId): boolean`.
