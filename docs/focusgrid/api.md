# API

The functions meant to be used in a scriptable / programmatic way, as opposed
to human input. These functions live on `controller.api` after creating a
controller with `createFocusGridController()`.

```ts
import { createFocusGridController } from "@focusgrid/focusgrid/core";

const controller = createFocusGridController(initialState);
controller.api.split("editor", { side: "right", newPaneId: "terminal" });

const controllerWithMinimums = createFocusGridController(initialState, {
  paneDefaults: {
    minWidth: 240,
    minHeight: 160,
    canRemove: false,
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
  canResizeX?: boolean;
  canResizeY?: boolean;
  canRemove?: boolean;
  canSplitHorizontal?: boolean;
  canSplitVertical?: boolean;
  canSwapX?: boolean;
  canSwapY?: boolean;
  canFocus?: boolean;
};

type CreateFocusGridControllerOptions = {
  commands?: CommandRegistry;
  paneDefaults?: PaneDefaults;
  directionalFocusOverflow?: boolean;
};

type SplitPaneOptions = {
  side: PaneSplitSide;
  newPaneId?: PaneId;
  minWidth?: number;
  minHeight?: number;
  data?: unknown;
  preserveActivePane?: boolean;
  canResizeX?: boolean;
  canResizeY?: boolean;
  canRemove?: boolean;
  canSplitHorizontal?: boolean;
  canSplitVertical?: boolean;
  canSwapX?: boolean;
  canSwapY?: boolean;
  canFocus?: boolean;
};

type WrapRootInSplitOptions = {
  side: PaneSplitSide;
  newPaneId?: PaneId;
  minWidth?: number;
  minHeight?: number;
  data?: unknown;
  preserveActivePane?: boolean;
  canResizeX?: boolean;
  canResizeY?: boolean;
  canRemove?: boolean;
  canSplitHorizontal?: boolean;
  canSplitVertical?: boolean;
  canSwapX?: boolean;
  canSwapY?: boolean;
  canFocus?: boolean;
};

type ResizePaneOptions = {
  direction: PaneResizeDirection;
  deltaPx: number;
};

type UpdatePaneCommandGuardsOptions = {
  canResizeX?: boolean;
  canResizeY?: boolean;
  canRemove?: boolean;
  canSplitHorizontal?: boolean;
  canSplitVertical?: boolean;
  canSwapX?: boolean;
  canSwapY?: boolean;
  canFocus?: boolean;
};
```

`paneDefaults` sets defaults for panes that do not already specify the same
field. Defaults are applied to the initial layout, inherited by panes created
through `controller.api.split()`, and used for panes inserted through
`controller.api.wrapRootInSplit()` unless that call supplies explicit values.
Omitted capability values are allowed. Explicit `false` values block the
matching default command, and explicit `true` pane values override `false`
defaults.

Pane command capabilities affect Focusgrid's default commands and keyboard
behavior, not direct `controller.api` calls:

- `canResizeX` / `canResizeY`: allow default left/right or up/down resize commands.
- `canRemove`: allows the default close command.
- `canSplitHorizontal` / `canSplitVertical`: allow default split-right or split-down commands.
- `canSwapX` / `canSwapY`: allow default swaps when both the active pane and target pane allow the matching axis.
- `canFocus`: allows default directional focus commands to focus that pane.

`directionalFocusOverflow` defaults to `false`. When set to `true`, default
directional focus commands wrap from a grid edge to the opposite side. Panes
with `canFocus: false` are skipped during both normal and overflow focus
search.

## `controller.api.split(paneId, options)`

```ts
split(paneId: PaneId, options: SplitPaneOptions): PaneId | null;
```

Splits `paneId` and inserts a new pane on `options.side`. If
`options.newPaneId` is omitted, Focusgrid generates one; the function returns
the new pane id when the split succeeds and `null` when `paneId` does not
exist or `options.newPaneId` already belongs to another pane. By default the
new pane becomes active, unless `preserveActivePane: true` is provided.
`minWidth`, `minHeight`, and `data` are copied onto the inserted pane when
provided.

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

Updates command capability fields on an existing pane. It returns `true` when a
capability changes and `false` when the pane does not exist or the supplied
values match the current pane.

## `controller.getPaneData(paneId)`

```ts
getPaneData<T = unknown>(paneId: PaneId): T | undefined;
```

Returns the pane's `data` value, or `undefined` when the pane does not exist.

## `controller.api.setPaneData(paneId, data)`

```ts
setPaneData(paneId: PaneId, data: unknown): boolean;
```

Updates an existing pane's `data` value. It returns `true` when the value
changes and `false` when the pane does not exist or the value is unchanged.

## State validation

`createFocusGridController()` and `deserializeFocusGridControllerState()` throw
`FocusGridStateValidationException` when public state is invalid. Use
`validateFocusGridControllerState(input)` to inspect structured validation
errors without throwing.

## React focus management

The React subpath exports the following opt-in focus-management type:

```ts
import type { RefObject } from "react";

type FocusGridFocusManagement = {
  mode: "application";
  scopeRef: RefObject<HTMLElement | null>;
};
```

`FocusGridProps` accepts it through `focusManagement`:

```ts
type FocusGridProps = {
  controller: FocusGridController;
  keymap?: KeyBinding[];
  renderPane: (ctx: PaneRenderContext) => ReactNode;
  className?: string;
  onPaneLayoutChange?: (event: PaneLayoutChangeEvent) => void;
  onPaneClose?: (event: PaneCloseEvent) => void;
  focusManagement?: FocusGridFocusManagement;
};
```

The option is resolved after React commits the application wrapper and grid.
Application mode throws a descriptive error when `scopeRef.current` does not
contain the rendered Focusgrid root. The DOM controller is recreated when the
controller, keymap, focus-management mode, or scope-ref identity changes.
Omitting the option preserves manual focus behavior.

## DOM focus management

The DOM subpath exports the resolved equivalent:

```ts
type FocusGridDomFocusManagement = {
  mode: "application";
  scope: HTMLElement;
};

type FocusGridDomControllerOptions = {
  keymap?: KeyBinding[];
  focusManagement?: FocusGridDomFocusManagement;
};
```

Direct DOM consumers pass an existing scope element when constructing the DOM
controller:

```ts
import { FocusGridDomController } from "@focusgrid/focusgrid/dom";

const domController = new FocusGridDomController(controller, gridRoot, {
  keymap,
  focusManagement: {
    mode: "application",
    scope: applicationShell,
  },
});

domController.mount();
// Later:
domController.destroy();
```

The scope must contain `gridRoot`. Mounting and destroying are idempotent.
Destroying removes focus, pointer, window, keyboard, resize, and controller
listeners, cancels pending focus redirects, and releases remembered descendant
references.

Application focus restoration follows this order:

1. A still-connected, focusable remembered descendant in the destination pane.
2. The first enabled tabbable descendant in DOM order.
3. The pane shell.

External interactive ownership always wins over controller-driven or
window-reactivation restoration. A primary pointer press on static content in
the application scope schedules restoration after default pointer focus
behavior; presses inside the grid or inside interactive controls are ignored.
