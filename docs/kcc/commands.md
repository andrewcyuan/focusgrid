# Commands

KCC has native collection commands for structural navigation. Application
behavior such as activation, editing, deletion, and menu opening should be
registered as `KCItem` or `KCList` action bindings.

```ts
import { createKCController } from "@focusgrid/kcc-core";

const controller = createKCController({
  itemIds: ["compose", "inbox", "labels"],
  activeItemId: "compose",
  orientation: "vertical",
});

controller.commands.moveActive("down");
controller.getState().activeItemId; // "inbox"
```

## Shared Types

```ts
type KCMoveDirection = "up" | "down" | "left" | "right" | "start" | "end";

type KCCommandName = "moveActive" | "activate" | "edit";

type KCCommandArgs =
  | {
      direction: KCMoveDirection;
      count?: number;
    }
  | undefined;

type KCActionBinding<T> = {
  sequence: KeySequence | string;
  action: KCItemAction<T> | KCCommandAction;
  command?: KCCommandName;
  preventDefault?: boolean;
  repeat?: boolean;
};
```

## `moveActive(direction, count?)`

```ts
moveActive(direction: KCMoveDirection, count?: number): boolean;
```

Moves the active item and returns `true` when `activeItemId` changes. Movement is
orientation-aware:

- vertical collections respond to `up` and `down`
- horizontal collections respond to `left` and `right`
- both orientations respond to `start` and `end`

Movement clamps by default. Set `wrapAround` on the controller or collection to
wrap from end to start.

## Native Keymap

Use `createDefaultKCCollectionKeymap()` for collection-owned movement:

```ts
const nativeKeymap = createDefaultKCCollectionKeymap({
  overrides: {
    "move-down": "J",
    "move-up": "K",
  },
});
```

Default movement shortcuts:

- `Up`: move up
- `Down`: move down
- `Left`: move left
- `Right`: move right
- `Home`: move to the first item
- `End`: move to the last item

## Custom Actions

Attach application actions to the receiver that owns the data:

```tsx
const rowActions: KCActionBinding<TodoItem>[] = [
  {
    sequence: "Space",
    command: "activate",
    action: (ctx) => toggleTodo(ctx.id),
  },
  {
    sequence: "Enter",
    command: "edit",
    action: (ctx) => editTodo(ctx.id),
  },
];

<KCList
  dataList={todos}
  getItemId={(todo) => todo.id}
  customActionKeybinds={rowActions}
  renderCell={renderTodo}
/>;
```

The collection routes keyboard events in this order:

1. Normalize the event at the collection root.
2. Try native collection movement bindings.
3. If a native binding matches, run it and stop.
4. Resolve custom bindings for the active registered entry.
5. If a custom binding matches, run it with that entry's action context.

Native collection bindings always win. Conflicts warn and remain deterministic.

Activation, editing, deletion, and other app-specific behavior should be
attached to `KCItem` or `KCList` through `customActionKeybinds`.
