# @focusgrid/shortcut-engine

Shortcut parsing, key normalization, and stateful routing for keyboard-native
interfaces.

```ts
import {
  KeyRouter,
  parseKeySequence,
  routeKeyboardEvent,
} from "@focusgrid/shortcut-engine";
```

This package does not own focus, DOM policy, command registries, or app state.
It is the routing layer used by Focusgrid packages and application adapters.
