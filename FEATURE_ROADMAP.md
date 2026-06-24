# Feature Roadmap

This roadmap is incomplete, but it should describe the next useful pieces of
Focusgrid without duplicating work that already exists.

## Current foundation

- Core workspace state, reducer, layout solver, and serialization.
- Scriptable pane API on `workspace.api` for splitting, removing, swapping,
  resizing, and directly focusing panes.
- Command registry and default pane commands for keyboard-driven split, close,
  resize, directional focus, and directional swap.
- DOM keyboard routing, root resize observation, pointer resize handles, and
  React pane rendering.
- Repeatable multi-stroke key bindings for tmux-style leader workflows.

## Near-term

### Pane rendering context

Expose richer pane context to React renderers:

```ts
type PaneRenderContext = {
  paneId: string;
  rect: Rect;
  active: boolean;
  workspace: Workspace;
};
```

This lets pane content respond to active state and measured layout without
reaching into workspace internals.

### Layout-change callbacks

Add a React callback for panes whose embedded widgets need explicit layout
updates after rect changes:

```ts
type PaneRootProps = {
  renderPane: (ctx: PaneRenderContext) => ReactNode;
  onPaneLayoutChange?: (ctx: PaneRenderContext) => void;
  onPaneClose?: (ctx) => void;
};
```

This is intended for editors, terminals, canvases, and other components that
need an imperative resize notification.

### Programmatic layout expansion

Add higher-level layout operations around the existing pane API:

- `wrapRoot(direction, side, sizes, preserveActivePane)` to insert a new split
  around the current root.
- Root-level insertion helpers for adding sidebars, terminals, inspectors, and
  other app-level panes.
- Optional helpers for selecting and swapping by direction when the caller
  wants command-like behavior from code.

### Pane lifecycle integration

Define how apps associate pane ids with rendered content:

- Split a pane and attach a client component or descriptor to the new pane.
- Remove pane content when a pane closes.
- Preserve or migrate pane data when panes are swapped.

## KeyboardControlledList

A future component package for deterministic keyboard navigation inside a pane.
It should be useful for command palettes, file lists, tabs, results panes, and
other list-like UI.

### Shape

- Vertical or horizontal orientation.
- Controlled active item state: `activeIndex` plus a setter.
- Optional callback to run an action for a row: `(row) => void`.
- Internal focus state so the list can style active rows differently when the
  list itself is focused.
- Not intended for deeply nested lists at first.

### Commands

- `moveUp`
- `moveDown`
- `moveLeft`
- `moveRight`
- `multiply(command)` for repeatable movement commands.
- `moveHalfPageUp`
- `moveHalfPageDown`
- `moveHalfPageLeft`
- `moveHalfPageRight`
- `moveToStart`
- `moveToEnd`
- `remove(index)`
- `insert(index, component)`
- `swapForward(index)`
- `swapBackward(index)`

## Session support

Session support is still undecided. The main question is whether Focusgrid
should own persistence beyond serializing layout state, or whether apps should
store workspace state and pane content descriptors themselves.

Possible future work:

- Versioned session schema.
- Restore pane layout plus active pane.
- Restore app-provided pane descriptors without coupling core to React.
- Migration hooks for older saved layouts.
