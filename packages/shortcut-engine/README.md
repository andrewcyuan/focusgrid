# Shortcut engine

Keyboard sequences scoped to the focused component and its ancestors.

```tsx
import { ShortcutScope, useShortcuts } from "@andrewcyuan/shortcut-engine/react";

function Editor({ save }: { save: () => void }) {
  useShortcuts([{ sequence: "ctrl-s", action: save }]);
  return <textarea />;
}

export function App() {
  return <ShortcutScope><Editor save={() => alert("Saved")} /></ShortcutScope>;
}
```

No provider is needed. Nested scopes inherit their parent; hooks outside a scope use the default root. React handles binding updates, cleanup, and a shared capture-phase listener.

Use hyphens for chords and spaces for sequences: `ctrl-k`, `ctrl-k h`. Modifiers: `ctrl`, `cmd`, `alt`, `shift`. The deepest complete match wins; within a scope, the latest registration wins.

Bindings accept `when(event)`, `preventDefault` (default `true`), and `repeat`. Repeatable two-stroke followers stay active for 500 ms; fresh prefixes and direct shortcuts work immediately. Initial prefixes have no timeout. Scope changes reset sequences; pending and handled keys prevent browser defaults unless overridden.

Without React, import `createShortcutEngine` from `@andrewcyuan/shortcut-engine`. Register scopes with `registerScope({ id, parentId })`, add bindings with `registerBindings(id, bindings)`, select a scope with `setActiveScope(id)`, and pass keyboard events to `handle(event)`. Scope registration returns cleanup; binding registration returns `update` and `dispose`. Engine options include `repeatTimeoutMs`. The main entry point uses no React or browser globals.
