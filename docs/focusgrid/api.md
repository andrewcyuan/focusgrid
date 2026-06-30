# API

The functions meant to be used in a scriptable / programmatic way, as opposed
to human input. These functions live on `controller.api` after creating a
controller with `createFocusGridController()`.

```ts
import { createFocusGridController } from "@focusgrid/core";

const controller = createFocusGridController(initialState);
controller.api.split("editor", { side: "right", newPaneId: "terminal" });

const controllerWithMinimums = createFocusGridController(initialState, {
  paneDefaults: {
    minWidth: 240,
    minHeight: 160,
    noRemove: true,
  },
});
```

## Shared types

```ts
type PaneId = string;

type PaneSplitSide = "left" | "right" | "up" | "down";
type PaneResizeDirection = "left" | "right" | "up" | "down";

type PaneDefaults = {
  minWidth?: number;
  minHeight?: number;
  noResizeX?: boolean;
  noResizeY?: boolean;
  noRemove?: boolean;
  noSplitHorizontal?: boolean;
  noSplitVertical?: boolean;
  noSwapX?: boolean;
  noSwapY?: boolean;
  noFocus?: boolean;
};

type CreateFocusGridControllerOptions = {
  commands?: CommandRegistry;
  paneDefaults?: PaneDefaults;
  directionalFocusOverflow?: boolean;
};

type SplitPaneOptions = {
  side: PaneSplitSide;
  newPaneId?: PaneId;
  preserveActivePane?: boolean;
  noResizeX?: boolean;
  noResizeY?: boolean;
  noRemove?: boolean;
  noSplitHorizontal?: boolean;
  noSplitVertical?: boolean;
  noSwapX?: boolean;
  noSwapY?: boolean;
  noFocus?: boolean;
};

type WrapRootInSplitOptions = {
  side: PaneSplitSide;
  newPaneId?: PaneId;
  minWidth?: number;
  minHeight?: number;
  data?: unknown;
  preserveActivePane?: boolean;
  noResizeX?: boolean;
  noResizeY?: boolean;
  noRemove?: boolean;
  noSplitHorizontal?: boolean;
  noSplitVertical?: boolean;
  noSwapX?: boolean;
  noSwapY?: boolean;
  noFocus?: boolean;
};

type ResizePaneOptions = {
  direction: PaneResizeDirection;
  deltaPx: number;
};

type UpdatePaneCommandGuardsOptions = {
  noResizeX?: boolean;
  noResizeY?: boolean;
  noRemove?: boolean;
  noSplitHorizontal?: boolean;
  noSplitVertical?: boolean;
  noSwapX?: boolean;
  noSwapY?: boolean;
  noFocus?: boolean;
};
```

`paneDefaults` sets defaults for panes that do not already specify the same
field. Defaults are applied to the initial layout, inherited by panes created
through `controller.api.split()`, and used for panes inserted through
`controller.api.wrapRootInSplit()` unless that call supplies explicit values.
Explicit `false` pane guard values override `true` defaults.

Pane command guards affect Focusgrid's default commands and keyboard behavior,
not direct `controller.api` calls:

- `noResizeX` / `noResizeY`: block default left/right or up/down resize commands.
- `noRemove`: blocks the default close command.
- `noSplitHorizontal` / `noSplitVertical`: block default split-right or split-down commands.
- `noSwapX` / `noSwapY`: block default swaps when either the active pane or target pane has the matching guard.
- `noFocus`: prevents default directional focus commands from focusing that pane.

`directionalFocusOverflow` defaults to `false`. When set to `true`, default
directional focus commands wrap from a grid edge to the opposite side. Panes
with `noFocus` are skipped during both normal and overflow focus search.

## `controller.api.split(paneId, options)`

```ts
split(paneId: PaneId, options: SplitPaneOptions): PaneId | null;
```

Splits `paneId` and inserts a new pane on `options.side`. If
`options.newPaneId` is omitted, Focusgrid generates one; the function returns
the new pane id when the split succeeds and `null` when `paneId` does not
exist or `options.newPaneId` already belongs to another pane. By default the
new pane becomes active, unless `preserveActivePane: true` is provided.

## `controller.api.wrapRootInSplit(options)`

```ts
wrapRootInSplit(options: WrapRootInSplitOptions): PaneId | null;
```

Wraps the current root layout in a new top-level split and inserts one new pane
beside the existing root on `options.side`. If `options.newPaneId` is omitted,
Focusgrid generates one; the function returns the new pane id when the wrap
succeeds and `null` when `options.newPaneId` already belongs to another pane.
By default the new pane becomes active, unless `preserveActivePane: true` is
provided. `minWidth`, `minHeight`, and `data` are copied onto the inserted pane.

## `controller.api.remove(paneId)`

```ts
remove(paneId: PaneId): boolean;
```

Removes `paneId` from the controller and collapses any split that would be left
with a single child. It returns `true` when the pane was removed and `false`
when the pane does not exist or is the last remaining pane. If the removed pane
was active, the first remaining pane becomes active.

## `controller.api.swap(firstPaneId, secondPaneId)`

```ts
swap(firstPaneId: PaneId, secondPaneId: PaneId): boolean;
```

Swaps the pane content assigned to two layout slots while preserving the split
tree, split sizes, and pane node ids. It returns `true` when both pane ids exist
and are different, otherwise `false`. The active pane id is preserved, so focus
follows the pane content after the swap.

## `controller.api.resize(paneId, options)`

```ts
resize(paneId: PaneId, options: ResizePaneOptions): boolean;
```

Resizes `paneId` against the nearest adjacent split boundary in
`options.direction` by `options.deltaPx` pixels. It returns `true` when a split
size changes and `false` when the pane or resize boundary cannot be found, or
when minimum-size constraints prevent any change.

## `controller.api.focus(paneId)`

```ts
focus(paneId: PaneId): boolean;
```

Makes `paneId` the active pane and updates split focus memory along its path.
It returns `true` when focus changes and `false` when the pane does not exist
or is already the active pane.

## `controller.api.updatePaneCommandGuards(paneId, options)`

```ts
updatePaneCommandGuards(
  paneId: PaneId,
  options: UpdatePaneCommandGuardsOptions,
): boolean;
```

Updates command guard fields on an existing pane. It returns `true` when a
guard changes and `false` when the pane does not exist or the supplied values
match the current pane.
