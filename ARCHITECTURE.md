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
  Thin React wrapper. Owns context, hooks, refs, and rendering helpers.
```

Core does not import DOM or React. DOM imports core. React imports core and DOM.

## Runtime Flow

The main update path is:

```txt
browser event / command
  -> workspace.api method
  -> core layout operation returns new WorkspaceState
  -> workspace listeners fire
  -> React useSyncExternalStore updates
  -> PaneRoot recomputes layout
  -> PaneView rerenders with new rect style
```

The center of the system is `Workspace.api` in
`packages/core/src/workspace.ts`. API methods run layout operations, store the
new state, and notify subscribers when the state object changes.

## Core Package

The persistent state shape lives in `packages/core/src/layout/types.ts`:

```ts
type WorkspaceState = {
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

The layout operations are in `packages/core/src/layout/operations.ts`. The main
workspace API operations are:

```txt
setContainerSize
focus
split
remove
resize
resizeHandle
```

Actual pixel layout is computed on demand in
`packages/core/src/layout/solver.ts`. `computeLayout(state)` walks the tree and
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
dispatches workspace actions.

Root size changes come from `packages/dom/src/resize-observer.ts`:

```txt
ResizeObserver fires
  -> dispatch container.setSize
  -> workspace updates
  -> React rerenders layout
```

Handle drags come from `packages/dom/src/pointer-resize.ts`:

```txt
pointermove on resize handle
  -> dispatch handle.resize
  -> split sizes update
  -> layout recomputes
```

The root DOM controller in `packages/dom/src/controller.ts` wires keyboard
handling and resize observation together.

## React Package

The React package owns the public rendering API.

The current public render API is in `packages/react/src/PaneRoot.tsx`:

```ts
export type PaneRootProps = {
  renderPane: (paneId: string) => ReactNode;
  keymap?: KeyBinding[];
  className?: string;
};
```

`PaneRoot` reads the computed layout:

```ts
const layout = useComputedLayout();
```

Then it renders every computed pane:

```tsx
{layout.panes.map((pane) => (
  <PaneView key={pane.paneId} pane={pane} renderPane={renderPane} />
))}
```

The subscription is in `packages/react/src/hooks.ts`. `useSyncExternalStore`
subscribes to `workspace.subscribe()`, so any successful dispatch causes React
to update.

The content render call is in `packages/react/src/PaneView.tsx`:

```tsx
{renderPane(pane.paneId)}
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

Today, clients do not get explicit layout data in `renderPane`, but their React
subtree rerenders whenever layout changes because `PaneView` rerenders.

## Adding Render And Layout-Change Callbacks

If the goal is to let clients pass both an initial `render()` and a callback
that runs when layout changes, the files to start with are:

```txt
packages/react/src/PaneRoot.tsx
packages/react/src/PaneView.tsx
packages/react/src/hooks.ts
```

This likely does not belong in `core`. Core already exposes layout. It also
probably does not belong in `dom`, unless the API should support a non-React
imperative renderer.

A pragmatic React API would be:

```ts
type PaneRenderContext = {
  paneId: string;
  rect: Rect;
  active: boolean;
  workspace: Workspace;
};

type PaneRootProps = {
  renderPane: (ctx: PaneRenderContext) => ReactNode;
  onPaneLayoutChange?: (ctx: PaneRenderContext) => void;
  keymap?: KeyBinding[];
  className?: string;
};
```

`renderPane` would return React content. `onPaneLayoutChange` would perform
imperative side effects after layout changes, such as calling `.layout()` on a
Monaco editor, terminal, canvas, or other embedded widget.

In `PaneView`, the shape would be:

```ts
useLayoutEffect(() => {
  onPaneLayoutChange?.({
    paneId: pane.paneId,
    rect: pane.rect,
    active: pane.active,
    workspace,
  });
}, [
  onPaneLayoutChange,
  pane.paneId,
  pane.rect.x,
  pane.rect.y,
  pane.rect.width,
  pane.rect.height,
  pane.active,
  workspace,
]);
```

Then the render call would change from:

```tsx
{renderPane(pane.paneId)}
```

to:

```tsx
{renderPane({
  paneId: pane.paneId,
  rect: pane.rect,
  active: pane.active,
  workspace,
})}
```

The distinction matters:

```txt
renderPane
  returns React content

onPaneLayoutChange
  tells imperative embedded content that its pane rect changed
```

The name `onPaneLayoutChange` is clearer than `rerenderPane`, because React
already owns rerendering. The callback is really a layout notification hook.

## Where To Look When Debugging

For client rendering behavior, start in:

```txt
packages/react/src/PaneRoot.tsx
packages/react/src/PaneView.tsx
```

For why layout changed, trace backward through:

```txt
packages/react/src/hooks.ts
packages/core/src/workspace.ts
packages/core/src/layout/operations.ts
packages/core/src/layout/solver.ts
```

For browser-driven layout changes, start in:

```txt
packages/dom/src/resize-observer.ts
packages/dom/src/pointer-resize.ts
```

The shortest mental model is:

```txt
PaneRoot renders from useComputedLayout()
useComputedLayout() subscribes to Workspace
Workspace.api methods are the state transition gate
layout operations change tree/container/sizes
computeLayout() converts tree/sizes/container into pixel rects
PaneView applies those rects and renders client content
```
