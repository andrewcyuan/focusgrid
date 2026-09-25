# Shortcut engine

Shortcut engine routes one keyboard sequence through nested scopes, from the active scope to its ancestors, and runs callback bindings.

```ts
import { createShortcutEngine, parseKeySequence } from "@andrewcyuan/shortcut-engine";

const engine = createShortcutEngine();
const removeScope = engine.registerScope({
  id: "editor",
  parentId: null,
  element: document.querySelector("#editor")!,
});
const shortcuts = engine.registerBindings("editor", [
  {
    sequence: parseKeySequence("Ctrl-K Ctrl-H"),
    action: event => window.alert(`Help opened with ${event.key}`),
  },
]);
const unmount = engine.mount(document);

// On teardown:
// shortcuts.dispose();
// removeScope();
// unmount();
```

Use one engine per document. Focus selects the nearest registered element's scope; `setActiveScope(id)` also supports explicit activation, and `null` disables routing.

Each scope has a `parentId`; multiple components can call `registerBindings` for the same scope. The deepest complete match wins, even when a deeper scope has a partial match. Within one scope, the latest eligible registration wins; disposing it restores the previous binding. `shortcuts.update(bindings)` preserves registration priority.

Bindings accept `when(event)`, `preventDefault` (default `true`), and `repeat` for repeating two-stroke followers within 500 ms. Callbacks capture their own state. Pending sequences consume browser events and reset when the active scope changes; `engine.reset()` clears them explicitly. A complete parent shortcut runs immediately, so a child sequence that extends that exact shortcut cannot complete.
