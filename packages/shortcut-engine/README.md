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

Nested scopes inherit their parent; hooks outside a scope use the default root. React handles binding updates, cleanup, and a shared capture-phase listener.

Use hyphens for chords and spaces for sequences: `ctrl-k`, `ctrl-k h`. Modifiers: `ctrl`, `cmd`, `alt`, `shift`. When there are multiple potential matches to a set of keyboard events, the deepest-scoped complete match wins. Within a scope, the latest registration wins.

Made by [Andrew Yuan](https://andrewcyuan.com).
