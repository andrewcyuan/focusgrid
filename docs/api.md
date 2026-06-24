# API

The functions meant to be used in a scriptable / programmatic way, as opposed
to human input. These functions live on `workspace.api` after creating a
workspace with `createWorkspace()`.

```ts
import { createWorkspace } from "@focusgrid/core";

const workspace = createWorkspace(initialState);
workspace.api.split("editor", { side: "right", newPaneId: "terminal" });
```

## Shared types

```ts
type PaneId = string;

type PaneSplitSide = "left" | "right" | "up" | "down";
type PaneResizeDirection = "left" | "right" | "up" | "down";

type SplitPaneOptions = {
  side: PaneSplitSide;
  newPaneId?: PaneId;
  preserveActivePane?: boolean;
};

type ResizePaneOptions = {
  direction: PaneResizeDirection;
  deltaPx: number;
};
```

## `workspace.api.split(paneId, options)`

```ts
split(paneId: PaneId, options: SplitPaneOptions): PaneId | null;
```

Splits `paneId` and inserts a new pane on `options.side`. If
`options.newPaneId` is omitted, Focusgrid generates one; the function returns
the new pane id when the split succeeds and `null` when `paneId` does not
exist or `options.newPaneId` already belongs to another pane. By default the
new pane becomes active, unless `preserveActivePane: true` is provided.

## `workspace.api.remove(paneId)`

```ts
remove(paneId: PaneId): boolean;
```

Removes `paneId` from the workspace and collapses any split that would be left
with a single child. It returns `true` when the pane was removed and `false`
when the pane does not exist or is the last remaining pane. If the removed pane
was active, the first remaining pane becomes active.

## `workspace.api.swap(firstPaneId, secondPaneId)`

```ts
swap(firstPaneId: PaneId, secondPaneId: PaneId): boolean;
```

Swaps the pane content assigned to two layout slots while preserving the split
tree, split sizes, and pane node ids. It returns `true` when both pane ids exist
and are different, otherwise `false`. The active pane id is preserved, so focus
follows the pane content after the swap.

## `workspace.api.resize(paneId, options)`

```ts
resize(paneId: PaneId, options: ResizePaneOptions): boolean;
```

Resizes `paneId` against the nearest adjacent split boundary in
`options.direction` by `options.deltaPx` pixels. It returns `true` when a split
size changes and `false` when the pane or resize boundary cannot be found, or
when minimum-size constraints prevent any change.

## `workspace.api.focus(paneId)`

```ts
focus(paneId: PaneId): boolean;
```

Makes `paneId` the active pane and updates split focus memory along its path.
It returns `true` when focus changes and `false` when the pane does not exist
or is already the active pane.
