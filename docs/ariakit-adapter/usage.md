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
import { useMemo, useState } from "react";
import {
  createCompositeNavigationKeymap,
  useCompositeShortcutRouter,
} from "@focusgrid/ariakit-adapter/react";
import { parseKeySequence } from "@focusgrid/shortcut-engine";

type MailAction =
  | "move-left"
  | "move-right"
  | "move-up"
  | "move-down"
  | "move-start"
  | "move-end"
  | "open"
  | "toggle-read";

function Mailbox({ rows }: { rows: readonly MailRow[] }) {
  const composite = useCompositeStore({ orientation: "vertical" });
  const [activeId, setActiveId] = useState(rows[0]?.id ?? null);

  const keymap = useMemo(
    () => [
      ...createCompositeNavigationKeymap({
        overrides: {
          "move-up": "K",
          "move-down": "J",
          "move-start": "G G",
          "move-end": "Shift-G",
        },
      }),
      {
        sequence: parseKeySequence("Enter"),
        action: "open",
      },
      {
        sequence: parseKeySequence("Space"),
        action: "toggle-read",
      },
    ],
    [],
  );

  const { compositeProps } = useCompositeShortcutRouter({
    keymap,
    getContext: () => ({
      activeId,
      rows,
    }),
    onMatch: (match) => {
      if (match.action === "move-down") {
        setActiveId(nextRowId(rows, activeId));
      } else if (match.action === "open" && activeId) {
        openMessage(activeId);
      }
    },
  });

  return (
    <Composite store={composite} {...compositeProps}>
      {rows.map((row) => (
        <CompositeItem
          key={row.id}
          id={row.id}
          data-active={row.id === activeId}
        >
          {row.subject}
        </CompositeItem>
      ))}
    </Composite>
  );
}
```

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
