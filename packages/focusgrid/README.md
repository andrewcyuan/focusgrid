# Focusgrid

Create tmux-like, resizable-pane layouts. Use the included React bindings (reocmmended) or write your own bindings to the `focusgrid/core` and `focusgrid/dom` packages!

You can put any react component in the panes using the `renderPane` prop and support all basic layout actions: resize, split, delete, swap, move focus.

The react bindings are also dependent on [shortcut-engine](https://www.npmjs.com/package/@andrewcyuan/shortcut-engine) for out-of-the-box keyboard support.

**Example usage**
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

**Customizing Focusgrid**
Focusgrid can be easily customized. It can be the surface in which you create your entire webapp. Here are some ways you can customize it.

- Define the grid's width and height. When these change, panes are scaled proportionally (not the left-shrinks-first strategy that `tmux` uses)
- Replace the keybinds by passing `keymap`
- Directly hit the API by using controller commands: `splitActive`, `removeActive`, `focusAdjacent`, `swapAdjacent`, and `resizeActive`. `focus(paneId)` only syncs active-pane state; `focusAdjacent(direction)` also requests DOM focus.
- Read layout with `getLayout()`/`useControllerLayout(controller)` (React version). You can also directly mutate the layout, although using the API is probably easier and safer.
- To write your own frontend framework binding, use `getPane`, `getContainerSize`, and `getSplitSizes` for specific queries, and `subscribe` for changes.


Made by [Andrew Yuan](https://andrewcyuan.com)
