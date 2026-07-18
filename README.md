# Focusgrid

Focusgrid is a small set of libraries for building keyboard-native web
interfaces with deterministic focus and shortcut routing.

## Packages

- `@focusgrid/focusgrid`: pane layout, DOM behavior, and React bindings through
  explicit subpaths.
- `@focusgrid/shortcut-engine`: key sequence parsing, normalization, and
  stateful shortcut routing.
- `@focusgrid/ariakit-adapter`: React helpers for routing Focusgrid shortcuts
  through Ariakit `Composite` roots.

`@focusgrid/focusgrid` intentionally has no root export. Import the layer you
need:

```ts
import { createFocusGridController } from "@focusgrid/focusgrid/core";
import { FocusGrid } from "@focusgrid/focusgrid/react";
import "@focusgrid/focusgrid/react/styles.css";
```

## Docs

- Focusgrid: [`docs/focusgrid/usage.md`](docs/focusgrid/usage.md),
  [`docs/focusgrid/api.md`](docs/focusgrid/api.md), and
  [`docs/focusgrid/commands.md`](docs/focusgrid/commands.md).
- Shortcut Engine: [`docs/shortcut-engine/usage.md`](docs/shortcut-engine/usage.md)
  and [`docs/shortcut-engine/api.md`](docs/shortcut-engine/api.md).
- Ariakit Adapter: [`docs/ariakit-adapter/usage.md`](docs/ariakit-adapter/usage.md)
  and [`docs/ariakit-adapter/api.md`](docs/ariakit-adapter/api.md).
- Packaging and local consumer testing: [`docs/packaging.md`](docs/packaging.md).
