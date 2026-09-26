# Shortcut engine

Shortcut engine routes string key sequences through the active scope and its ancestors, running the deepest matching callback.

```ts
import { createShortcutEngine } from "@andrewcyuan/shortcut-engine";

const engine = createShortcutEngine();
const removeScope = engine.registerScope({ id: "editor", parentId: null });
const shortcuts = engine.registerBindings("editor", [
  { sequence: "ctrl-k ctrl-h", action: () => window.alert("Help") },
]);
engine.setActiveScope("editor");

const onKey = (event: KeyboardEvent) => { engine.handle(event); };
document.addEventListener("keydown", onKey, { capture: true });

// On teardown:
// document.removeEventListener("keydown", onKey, { capture: true });
// shortcuts.dispose();
// removeScope();
```

Use hyphens for combinations and spaces between strokes: `ctrl-k`, `ctrl-k h`. Modifiers are `ctrl`, `cmd`, `alt`, and `shift`; named keys include `left`, `enter`, `escape`, and `space`. Plus-separated combinations and modifier aliases are not supported. `normalizeShortcut(value)` validates and canonicalizes a string when needed by an editor; bindings are compiled automatically.

Scopes contain a parent ID and binding contributions, with no DOM elements. The caller updates `setActiveScope(id)` when focus changes; `null` disables routing. Focusgrid provides the DOM and React integration.

The deepest complete match wins immediately, even if a deeper scope has a partial match. Within one scope, the latest eligible registration wins; disposing it restores the previous binding. `shortcuts.update(bindings)` preserves registration priority.

Bindings accept `when(event)`, `preventDefault` (default `true`), and `repeat` for repeating two-stroke followers within 500 ms. Pending sequences consume browser events and reset on active-scope changes; `engine.reset()` clears them explicitly.
