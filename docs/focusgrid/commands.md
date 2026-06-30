# Commands

Commands are named actions intended for keyboard shortcuts and other human
input. A controller gets a default command registry unless a custom registry is
passed to `createFocusGridController()`.

```ts
import { createFocusGridController } from "@focusgrid/core";

const controller = createFocusGridController(initialState);
controller.commands.run("pane.splitRight", controller);
```

## Shared types

```ts
type CommandContext = {
  controller: FocusGridController;
  state: FocusGridControllerState;
};

type CommandHandler<TArgs = unknown> = (
  ctx: CommandContext,
  args: TArgs,
) => void;

type PaneResizeCommandArgs = {
  deltaPx?: number;
};
```

## `new CommandRegistry()`

```ts
new CommandRegistry(): CommandRegistry;
```

Creates an empty command registry. Use this when an app wants full control over
which commands exist instead of using Focusgrid's defaults.

## `registry.register(name, handler)`

```ts
register<TArgs>(
  name: string,
  handler: CommandHandler<TArgs>,
): () => void;
```

Registers `handler` under `name` and replaces any handler already using that
name. The returned function unregisters that command name from the registry.
Handlers receive the controller and a state snapshot from just before the
command runs, plus the optional args passed to `run()`.

## `registry.run(name, controller, args?)`

```ts
run(name: string, controller: FocusGridController, args?: unknown): boolean;
```

Runs the command registered as `name` against `controller`. It returns `true`
when a handler exists and was called, and `false` when the command name is not
registered. The return value does not indicate whether the handler changed
controller state.

## `createDefaultCommandRegistry()`

```ts
createDefaultCommandRegistry(): CommandRegistry;
```

Creates a registry containing Focusgrid's built-in pane commands. This is the
registry used by `createFocusGridController()` when `options.commands` is not provided.

## Default commands

### Splitting

```ts
controller.commands.run("pane.splitRight", controller);
controller.commands.run("pane.splitDown", controller);
```

Splits the active pane and inserts the new pane in the requested direction:

- `pane.splitRight`: inserts the new pane to the right.
- `pane.splitDown`: inserts the new pane below.

If there is no active pane, these commands do nothing.
If the active pane has `noSplitHorizontal`, `pane.splitRight` does nothing. If
the active pane has `noSplitVertical`, `pane.splitDown` does nothing.

### Closing

```ts
controller.commands.run("pane.close", controller);
```

Removes the active pane from the controller. If there is no active pane or the
active pane is the last remaining pane, the command does nothing.
If the active pane has `noRemove`, the command does nothing.

### Resizing

```ts
controller.commands.run("pane.resizeLeft", controller, {
  deltaPx: 48,
});
controller.commands.run("pane.resizeRight", controller, {
  deltaPx: 48,
});
controller.commands.run("pane.resizeUp", controller, {
  deltaPx: 48,
});
controller.commands.run("pane.resizeDown", controller, {
  deltaPx: 48,
});
```

Resizes the active pane against the nearest boundary in the requested
direction:

- `pane.resizeLeft`: nearest left boundary.
- `pane.resizeRight`: nearest right boundary.
- `pane.resizeUp`: nearest upper boundary.
- `pane.resizeDown`: nearest lower boundary.

`deltaPx` defaults to `DEFAULT_PANE_RESIZE_DELTA_PX` when omitted. If there is
no active pane or no matching boundary, these commands do nothing.
If the active pane has `noResizeX`, left/right resize commands do nothing. If
the active pane has `noResizeY`, up/down resize commands do nothing.

### Moving Focus

```ts
controller.commands.run("pane.focusLeft", controller);
controller.commands.run("pane.focusRight", controller);
controller.commands.run("pane.focusUp", controller);
controller.commands.run("pane.focusDown", controller);
```

Moves focus from the active pane to the nearest pane in the requested
direction:

- `pane.focusLeft`: nearest pane on the left.
- `pane.focusRight`: nearest pane on the right.
- `pane.focusUp`: nearest pane above.
- `pane.focusDown`: nearest pane below.

If there is no active pane or no pane in that direction, these commands do
nothing. Panes with `noFocus` are skipped. When the controller is created with
`directionalFocusOverflow: true`, moving focus at a grid edge wraps to the
opposite side and still skips panes with `noFocus`.

### Swapping

```ts
controller.commands.run("pane.swapLeft", controller);
controller.commands.run("pane.swapRight", controller);
controller.commands.run("pane.swapUp", controller);
controller.commands.run("pane.swapDown", controller);
```

Swaps the active pane with the nearest pane in the requested direction while
preserving layout slots and split sizes:

- `pane.swapLeft`: nearest pane on the left.
- `pane.swapRight`: nearest pane on the right.
- `pane.swapUp`: nearest pane above.
- `pane.swapDown`: nearest pane below.

If there is no active pane or no pane in that direction, these commands do
nothing.
If either the active pane or directional target pane has `noSwapX`, left/right
swap commands do nothing. If either pane has `noSwapY`, up/down swap commands do
nothing.
