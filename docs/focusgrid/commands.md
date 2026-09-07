# Commands

Commands are named actions intended for keyboard shortcuts and other human
input. Every controller owns a default command registry. Applications can add
commands or replace individual defaults with `registry.register()`.

```ts
import { createFocusGridController } from "@focusgrid/focusgrid/core";

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

Creates an empty command registry for standalone command composition. Focusgrid
controllers always create their own registry containing the default commands.

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
registry used by every `createFocusGridController()` call.

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
If the active pane has `canSplitHorizontal: false`, `pane.splitRight` does
nothing. If the active pane has `canSplitVertical: false`, `pane.splitDown`
does nothing.

### Closing

```ts
controller.commands.run("pane.close", controller);
```

Removes the active pane from the controller. If there is no active pane or the
active pane is the last remaining pane, the command does nothing.
If the active pane has `canRemove: false`, the command does nothing.

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
If the active pane has `canResizeX: false`, left/right resize commands do
nothing. If the active pane has `canResizeY: false`, up/down resize commands
do nothing.

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
nothing. Panes with `canFocus: false` are skipped. When the controller is
created with `directionalFocusOverflow: true`, moving focus at a grid edge
wraps to the opposite side and still skips panes with `canFocus: false`.

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
If either the active pane or directional target pane has `canSwapX: false`,
left/right swap commands do nothing. If either pane has `canSwapY: false`,
up/down swap commands do nothing.

## Default keyboard bindings

`createDefaultPaneKeymap()` from `@focusgrid/focusgrid/core` returns
`{ keymap, errors }`. Pass `keymap` to `FocusGrid` or the DOM controller.
Press and release `Ctrl-B`, then press the follower key:

| Action id | Command | Sequence |
| --- | --- | --- |
| `split-right` | `pane.splitRight` | `Ctrl-B %` |
| `split-down` | `pane.splitDown` | `Ctrl-B "` |
| `close` | `pane.close` | `Ctrl-B X` |
| `focus-left` | `pane.focusLeft` | `Ctrl-B Left` |
| `focus-right` | `pane.focusRight` | `Ctrl-B Right` |
| `focus-up` | `pane.focusUp` | `Ctrl-B Up` |
| `focus-down` | `pane.focusDown` | `Ctrl-B Down` |
| `swap-left` | `pane.swapLeft` | `Ctrl-B Shift-Left` |
| `swap-right` | `pane.swapRight` | `Ctrl-B Shift-Right` |
| `swap-up` | `pane.swapUp` | `Ctrl-B Shift-Up` |
| `swap-down` | `pane.swapDown` | `Ctrl-B Shift-Down` |
| `resize-left` | `pane.resizeLeft` | `Ctrl-B H` |
| `resize-right` | `pane.resizeRight` | `Ctrl-B L` |
| `resize-up` | `pane.resizeUp` | `Ctrl-B K` |
| `resize-down` | `pane.resizeDown` | `Ctrl-B J` |

Letters are case-insensitive in shortcut strings; `H` means the unshifted H
key. Resize bindings pass `deltaPx: 48` and retain the leader for repeatable
followers during the router's repeat window.

Override bindings by action id. An empty string disables the action; an invalid
string omits its binding and adds an entry to `errors` with `id`, `command`,
`sequence`, and `message`. Omitted overrides keep their defaults.

```ts
const { keymap, errors } = createDefaultPaneKeymap({
  overrides: {
    "split-right": "Ctrl-B V",
    close: "",
  },
});
```

`createDefaultPaneShortcuts()` returns the default strings keyed by action id;
`defaultPaneShortcutActions` provides labels, commands, sequences, and optional
args/repeat flags for building a shortcut settings UI.
