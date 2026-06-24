# Commands

Commands are named actions intended for keyboard shortcuts and other human
input. A workspace gets a default command registry unless a custom registry is
passed to `createWorkspace()`.

```ts
import { createWorkspace } from "@focusgrid/core";

const workspace = createWorkspace(initialState);
workspace.commands.run("pane.splitRight", workspace);
```

## Shared types

```ts
type CommandContext = {
  workspace: Workspace;
  state: WorkspaceState;
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
Handlers receive the workspace and a state snapshot from just before the
command runs, plus the optional args passed to `run()`.

## `registry.run(name, workspace, args?)`

```ts
run(name: string, workspace: Workspace, args?: unknown): boolean;
```

Runs the command registered as `name` against `workspace`. It returns `true`
when a handler exists and was called, and `false` when the command name is not
registered. The return value does not indicate whether the handler changed
workspace state.

## `createDefaultCommandRegistry()`

```ts
createDefaultCommandRegistry(): CommandRegistry;
```

Creates a registry containing Focusgrid's built-in pane commands. This is the
registry used by `createWorkspace()` when `options.commands` is not provided.

## Default commands

### Splitting

```ts
workspace.commands.run("pane.splitRight", workspace);
workspace.commands.run("pane.splitDown", workspace);
```

Splits the active pane and inserts the new pane in the requested direction:

- `pane.splitRight`: inserts the new pane to the right.
- `pane.splitDown`: inserts the new pane below.

If there is no active pane, these commands do nothing.

### Closing

```ts
workspace.commands.run("pane.close", workspace);
```

Removes the active pane from the workspace. If there is no active pane or the
active pane is the last remaining pane, the command does nothing.

### Resizing

```ts
workspace.commands.run("pane.resizeLeft", workspace, {
  deltaPx: 48,
});
workspace.commands.run("pane.resizeRight", workspace, {
  deltaPx: 48,
});
workspace.commands.run("pane.resizeUp", workspace, {
  deltaPx: 48,
});
workspace.commands.run("pane.resizeDown", workspace, {
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

### Moving Focus

```ts
workspace.commands.run("pane.focusLeft", workspace);
workspace.commands.run("pane.focusRight", workspace);
workspace.commands.run("pane.focusUp", workspace);
workspace.commands.run("pane.focusDown", workspace);
```

Moves focus from the active pane to the nearest pane in the requested
direction:

- `pane.focusLeft`: nearest pane on the left.
- `pane.focusRight`: nearest pane on the right.
- `pane.focusUp`: nearest pane above.
- `pane.focusDown`: nearest pane below.

If there is no active pane or no pane in that direction, these commands do
nothing.

### Swapping

```ts
workspace.commands.run("pane.swapLeft", workspace);
workspace.commands.run("pane.swapRight", workspace);
workspace.commands.run("pane.swapUp", workspace);
workspace.commands.run("pane.swapDown", workspace);
```

Swaps the active pane with the nearest pane in the requested direction while
preserving layout slots and split sizes:

- `pane.swapLeft`: nearest pane on the left.
- `pane.swapRight`: nearest pane on the right.
- `pane.swapUp`: nearest pane above.
- `pane.swapDown`: nearest pane below.

If there is no active pane or no pane in that direction, these commands do
nothing.
