# @focusgrid/ariakit-adapter

React helpers for routing Focusgrid shortcut bindings through Ariakit
`Composite` roots.

```tsx
import {
  createCompositeNavigationKeymap,
  useCompositeShortcutRouter,
} from "@focusgrid/ariakit-adapter/react";
```

The adapter provides hooks and shortcut helpers only. Ariakit owns composite
focus behavior, while the app owns data rendering, active-row state, scrolling,
and app-specific actions.
