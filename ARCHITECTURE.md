# Focusgrid Architecture

Focusgrid is split into three packages:

```txt
@focusgrid/core
  Pure TypeScript. Owns state, layout operations, commands, keyboard parsing,
  and geometry.

@focusgrid/dom
  Browser adapter. Owns KeyboardEvent, PointerEvent, ResizeObserver, and DOM
  focus behavior.

@focusgrid/react
  Thin React wrapper. Owns component instance wiring, hooks, refs, and
  rendering helpers.
```

Core does not import DOM or React. DOM imports core. React imports core and DOM.

## Runtime Flow

The main update path is:

```txt
browser event / command
  -> controller.api method
  -> core layout operation returns new FocusGridControllerState
  -> controller listeners fire
  -> React useSyncExternalStore updates
  -> FocusGrid recomputes layout
  -> PaneView rerenders with new rect style
```

The center of the system is `FocusGridController.api` in
`packages/focusgrid-core/src/controller.ts`. API methods run layout operations, store the
new state, and notify subscribers when the state object changes.

## Core Package

The persistent state shape lives in `packages/focusgrid-core/src/layout/types.ts`:

```ts
type FocusGridControllerState = {
  root: LayoutNode;
  activePaneId: PaneId | null;
  container: {
    width: number;
    height: number;
  };
};
```

`root` is a tree of panes and splits:

```txt
pane
split
  pane
  split
    pane
    pane
```

A `SplitNode` stores proportional `sizes`, not pixel rectangles. Pixel
rectangles are derived later from the current container size.

The layout operations are in `packages/focusgrid-core/src/layout/operations.ts`. The main
controller API operations are:

```txt
setContainerSize
focus
split
remove
resize
resizeHandle
```

Actual pixel layout is computed on demand in
`packages/focusgrid-core/src/layout/solver.ts`. `computeLayout(state)` walks the tree and
produces:

```ts
type ComputedLayout = {
  panes: ComputedPane[];
  handles: ComputedHandle[];
};
```

Each `ComputedPane` has a `rect`, so this is the object React uses to position
panes.

## DOM Package

The DOM package does not render panes. It only listens to browser events and
dispatches controller actions.

Root size changes come from `packages/focusgrid-dom/src/resize-observer.ts`:

```txt
ResizeObserver fires
  -> dispatch container.setSize
  -> controller updates
  -> React rerenders layout
```

Handle drags come from `packages/focusgrid-dom/src/pointer-resize.ts`:

```txt
pointermove on resize handle
  -> dispatch handle.resize
  -> split sizes update
  -> layout recomputes
```

The root DOM controller in `packages/focusgrid-dom/src/controller.ts` wires keyboard
handling and resize observation together.

## React Package

The React package owns the public rendering API.

`FocusGrid` is the React instance boundary. Each rendered grid receives its
own `FocusGridController` and optional keymap directly:

```ts
export type FocusGridProps = {
  controller: FocusGridController;
  keymap?: KeyBinding[];
  renderPane: (ctx: PaneRenderContext) => ReactNode;
  className?: string;
  onPaneLayoutChange?: (event: PaneLayoutChangeEvent) => void;
  onPaneClose?: (event: PaneCloseEvent) => void;
};
```

There is no provider or React context in this package. Hooks that need state or
layout take the controller explicitly:

```ts
const layout = useControllerLayout(controller);
```

Then it renders every computed pane:

```tsx
{layout.panes.map((pane) => (
  <PaneView
    key={pane.paneId}
    controller={controller}
    pane={pane}
    renderPane={renderPane}
  />
))}
```

The subscription is in `packages/focusgrid-react/src/hooks.ts`. `useSyncExternalStore`
subscribes to `controller.subscribe()`, so any successful dispatch causes React
to update.

The content render call is in `packages/focusgrid-react/src/PaneView.tsx`:

```tsx
{renderPane({
  paneId: pane.paneId,
  rect: pane.rect,
  active: pane.active,
  controller,
})}
```

The layout rect is applied as inline style in the same component:

```ts
const style = {
  left: pane.rect.x,
  top: pane.rect.y,
  width: pane.rect.width,
  height: pane.rect.height,
};
```
Lifecycle events are emitted from `FocusGrid` after comparing the previous and
current computed pane maps:

```ts
type PaneLayoutChangeEvent = {
  pane: ComputedPane;
  previousPane: ComputedPane;
  controller: FocusGridController;
};

type PaneCloseEvent = {
  paneId: PaneId;
  previousPane: ComputedPane;
  controller: FocusGridController;
};
```

`renderPane` returns React content. `onPaneLayoutChange` can perform
imperative side effects after layout changes, such as calling `.layout()` on a
Monaco editor, terminal, canvas, or other embedded widget.

## Where To Look When Debugging

For client rendering behavior, start in:

```txt
packages/focusgrid-react/src/FocusGrid.tsx
packages/focusgrid-react/src/PaneView.tsx
```

For why layout changed, trace backward through:

```txt
packages/focusgrid-react/src/hooks.ts
packages/focusgrid-core/src/controller.ts
packages/focusgrid-core/src/layout/operations.ts
packages/focusgrid-core/src/layout/solver.ts
```

For browser-driven layout changes, start in:

```txt
packages/focusgrid-dom/src/resize-observer.ts
packages/focusgrid-dom/src/pointer-resize.ts
```

The shortest mental model is:

```txt
FocusGrid renders from useControllerLayout(controller)
useControllerLayout(controller) subscribes to FocusGridController
FocusGridController.api methods are the state transition gate
layout operations change tree/container/sizes
computeLayout() converts tree/sizes/container into pixel rects
PaneView applies those rects and renders client content
```
