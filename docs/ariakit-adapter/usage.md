# Usage

`@focusgrid/ariakit-adapter` connects Focusgrid's shortcut routing model to an
Ariakit `Composite` root. It does not render collection components or own row
state. Ariakit owns composite focus behavior, the app owns data rendering and
active-row state, and the adapter owns keyboard shortcut routing.

The adapter exports from both `@focusgrid/ariakit-adapter` and
`@focusgrid/ariakit-adapter/react`.

## Composite root

Attach `compositeProps` to the Ariakit `Composite` root. The props include
`onKeyDownCapture` and `data-focusgrid-composite=""`.

```tsx
import { Composite, CompositeItem, useCompositeStore } from "@ariakit/react";
import { useMemo } from "react";
import {
  createCompositeNavigationKeymap,
  useCompositeShortcutRouter,
} from "@focusgrid/ariakit-adapter/react";
import { parseKeySequence } from "@focusgrid/shortcut-engine";

type MailRow = { id: string; subject: string };

type MailboxProps = {
  rows: readonly MailRow[];
  openMessage: (id: string) => void;
  toggleRead: (id: string) => void;
};

function Mailbox({ rows, openMessage, toggleRead }: MailboxProps) {
  const composite = useCompositeStore({ orientation: "vertical" });
  const keymap = useMemo(
    () => [
      ...createCompositeNavigationKeymap({
        overrides: {
          "move-left": "",
          "move-right": "",
          "move-up": "K",
          "move-down": "J",
          "move-start": "G G",
          "move-end": "Shift-G",
        },
      }),
      { sequence: parseKeySequence("Enter"), action: "open" },
      { sequence: parseKeySequence("Space"), action: "toggle-read" },
    ],
    [],
  );

  const { compositeProps } = useCompositeShortcutRouter({
    keymap,
    onMatch: ({ action }) => {
      switch (action) {
        case "move-up":
          composite.move(composite.up());
          break;
        case "move-down":
          composite.move(composite.down());
          break;
        case "move-start":
          composite.move(composite.first());
          break;
        case "move-end":
          composite.move(composite.last());
          break;
        case "open":
        case "toggle-read": {
          const activeId = composite.getState().activeId;
          if (!activeId || !rows.some((row) => row.id === activeId)) return;
          if (action === "open") openMessage(activeId);
          else toggleRead(activeId);
          break;
        }
      }
    },
  });

  return (
    <Composite store={composite} {...compositeProps}>
      {rows.map((row) => (
        <CompositeItem key={row.id} id={row.id}>
          {row.subject}
        </CompositeItem>
      ))}
    </Composite>
  );
}
```

Row ids must be unique in the document. Movement handlers call `composite.move()`
to move browser focus; actions read Ariakit's current active id. Left/right
bindings are disabled because this list is vertical.

`useCompositeShortcutRouter()` uses capture-phase keyboard handling. That lets a
matched workspace or collection shortcut call `preventDefault()` and
`stopPropagation()` before a focused descendant handles the event.

## Navigation shortcuts

`createCompositeNavigationKeymap()` returns movement bindings for:

- `move-left`
- `move-right`
- `move-up`
- `move-down`
- `move-start`
- `move-end`

The default sequences are `Left`, `Right`, `Up`, `Down`, `Home`, and `End`.
Pass `overrides` to support application-specific movement, including
H/J/K/L-style maps:

```ts
const keymap = createCompositeNavigationKeymap({
  overrides: {
    "move-left": "H",
    "move-down": "J",
    "move-up": "K",
    "move-right": "L",
  },
});
```

Empty or invalid overrides are omitted. They do not fall back to the default
sequence for that action. This lets a settings UI intentionally disable a
movement shortcut.

## App-owned actions

The adapter does not define activation, editing, row selection, data-list
rendering, scroll-into-view, or geometry calculations. Add app actions to the
same keymap using Shortcut Engine bindings:

```ts
import { parseKeySequence } from "@focusgrid/shortcut-engine";

const keymap = [
  ...createCompositeNavigationKeymap(),
  {
    sequence: parseKeySequence("Space"),
    action: "row.toggle",
  },
  {
    sequence: parseKeySequence("Enter"),
    action: "row.open",
  },
  {
    sequence: parseKeySequence("Ctrl-D"),
    action: "viewport.halfPageDown",
  },
];
```

Use `onMatch` to run those actions against app state:

```ts
useCompositeShortcutRouter({
  keymap,
  context: {
    activeId,
    visibleRows,
  },
  onMatch: ({ action, args, context }) => {
    runMailboxShortcut(action, args, context);
  },
});
```

For frequently changing context, prefer `getContext` so the handler reads fresh
state when the keydown happens.

## Ignored events

By default, the adapter ignores already-prevented events and editable targets:
text inputs, textareas, selects, contenteditable elements, and elements with
`role="textbox"`. Ignored events reset pending multi-stroke state by default.

Use `ignoreEvent` for app-specific exclusions:

```ts
const router = useCompositeShortcutRouter({
  keymap,
  onMatch,
  ignoreEvent: (event) => {
    return event.target instanceof HTMLElement
      ? event.target.closest("[data-ignore-shortcuts]") !== null
      : false;
  },
});
```

Set `resetOnIgnore: false` only when ignored DOM targets are still logically
inside the same shortcut sequence.

## Forwarding from surrounding code

The returned `compositeProps` include `data-focusgrid-composite=""`. Downstream
code that needs to find a composite boundary can query that marker:

```ts
const compositeRoot = element.closest<HTMLElement>(
  "[data-focusgrid-composite]",
);
```

This marker is intentionally generic. It should be used as the replacement
boundary for app-level event forwarding, not as an instruction to move data
rendering or scroll logic into the adapter.
