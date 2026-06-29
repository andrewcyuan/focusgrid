# Commands

Commands are named actions intended for keyboard shortcuts and other human
input. KCC has one built-in controller command for movement, plus logical row
actions that are usually supplied by the app through `createDefaultKCLKeymap()`.

```ts
import { createKCLController } from "@focusgrid/kcc-core";

const controller = createKCLController({
  itemCount: 3,
  orientation: "vertical",
});

controller.commands.moveActive("down");
```

## Shared types

```ts
type KCLMoveDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "start"
  | "end";

type KCLCommandName = "moveActive" | "activate" | "edit";

type KCLCommandArgs =
  | {
      direction: KCLMoveDirection;
      count?: number;
    }
  | undefined;

type KCLActionBinding<T> = {
  sequence: KeySequence | string;
  action: KCLCellAction<T> | KCLCommandAction;
  command?: KCLCommandName;
  preventDefault?: boolean;
  repeat?: boolean;
};
```

## `controller.commands.moveActive(direction, count?)`

```ts
moveActive(direction: KCLMoveDirection, count?: number): boolean;
```

Moves the active row and returns `true` when the active index changes.
`count` defaults to `1`.

Vertical lists respond to:

- `up`
- `down`
- `start`
- `end`

Horizontal lists respond to:

- `left`
- `right`
- `start`
- `end`

Movement clamps to the first and last item. Empty lists keep
`activeIndex: -1`.

## Default keyboard commands

`createDefaultKCLKeymap()` creates bindings for the built-in movement command
and the app-provided row actions.

```ts
const keymap = createDefaultKCLKeymap<TodoItem>({
  onActivate: (ctx) => toggleTodo(ctx.index),
  onEdit: (ctx) => editTodo(ctx.index),
});
```

### Moving

```ts
createDefaultKCLKeymap();
```

Default movement shortcuts:

- `Up`: move up.
- `Down`: move down.
- `Left`: move left.
- `Right`: move right.
- `Home`: move to the first row.
- `End`: move to the last row.

Arrow movement is orientation-aware. A vertical list ignores left/right movement,
and a horizontal list ignores up/down movement.

### Activating

```ts
createDefaultKCLKeymap<T>({
  onActivate: (ctx) => {
    // Toggle, open, select, or otherwise activate ctx.data.
  },
});
```

Default shortcut:

- `Space`: activate the active row.

If `onActivate` is omitted, the binding resolves to the logical `activate`
command but has no app behavior by itself.

### Editing

```ts
createDefaultKCLKeymap<T>({
  onEdit: (ctx) => {
    // Enter edit mode for ctx.index or ctx.data.
  },
});
```

Default shortcut:

- `Enter`: edit the active row.

If `onEdit` is omitted, the binding resolves to the logical `edit` command but
has no app behavior by itself.

## Shortcut overrides

```ts
const keymap = createDefaultKCLKeymap<TodoItem>({
  overrides: {
    activate: "Enter",
    edit: "E",
    "move-down": "J",
    "move-up": "K",
  },
  onActivate,
  onEdit,
});
```

Overrides are keyed by `KCLShortcutId`. Empty strings disable a default binding,
and invalid sequences are ignored when the keymap is resolved.

## Custom bindings

Apps can provide their own `KCLActionBinding` entries instead of the default
keymap.

```ts
const keymap: KCLActionBinding<Row>[] = [
  {
    sequence: "J",
    action: {
      command: "moveActive",
      args: { direction: "down" },
    },
    repeat: true,
  },
  {
    sequence: "X",
    action: (ctx) => archiveRow(ctx.data.id),
    preventDefault: true,
  },
];
```

Function actions receive the current active row context. Command actions are
handled by KCC itself when they refer to `moveActive`; logical `activate` and
`edit` are useful when paired with app callbacks from the default keymap.
