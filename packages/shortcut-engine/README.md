# Shortcut engine

Shortcut engine parses key sequences and routes keyboard input to named actions, with support for multi-key shortcuts and context conditions.

```ts
import {
  KeyRouter,
  parseKeySequence,
  routeKeyboardEvent,
} from "@andrewcyuan/shortcut-engine";

const router = new KeyRouter([
  { sequence: parseKeySequence("Ctrl-K Ctrl-H"), action: "help" },
]);

const listener = (event: KeyboardEvent) => {
  routeKeyboardEvent(event, router, {
    context: undefined,
    onMatch: ({ action }) => {
      if (action === "help") window.alert("Help opened");
    },
  });
};

window.addEventListener("keydown", listener, { capture: true });

// On teardown:
// window.removeEventListener("keydown", listener, { capture: true });
```
