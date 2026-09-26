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

Scopes contain a parent ID and binding contributions, with no DOM elements. The caller updates `setActiveScope(id)` when focus changes; `null` disables routing. The optional `@andrewcyuan/shortcut-engine/react` entry point provides React scopes and browser event handling; the main entry point imports no React and accesses no browser globals.

The deepest complete match wins immediately, even if a deeper scope has a partial match. Within one scope, the latest eligible registration wins; disposing it restores the previous binding. `shortcuts.update(bindings)` preserves registration priority.

Bindings accept `when(event)`, `preventDefault` (default `true`), and `repeat` for repeating two-stroke followers within 500 ms. The repeat window is configurable with `repeatTimeoutMs`; a fresh prefix or direct binding can start immediately within it. Initial prefixes have no timeout. Pending sequences consume browser events and reset on active-scope changes; `engine.reset()` clears them explicitly.

## React

```tsx
import { ShortcutScope, useShortcuts } from "@andrewcyuan/shortcut-engine/react";

function Editor() {
  useShortcuts([{ sequence: "ctrl-s", action: () => save() }]);
  return <textarea />;
}

function Workspace() {
  return <ShortcutScope><Editor /></ShortcutScope>;
}
```

No provider is required. Hooks outside a scope contribute to the module's default root scope. Nested scopes inherit their logical parent through `ShortcutScopeContext`, including across portals. Scope ancestry and bindings live in the engine's internal map.

Bindings register, update, and dispose in effects. Callback updates keep registration priority and pending sequences; sequence changes reset pending input. Consumers share one capture-phase document listener, which is removed when the final consumer unmounts. Pending and handled shortcuts consume input before focused textboxes can edit it. React is an optional peer for this entry point only.
