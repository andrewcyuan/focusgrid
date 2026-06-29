# API

The functions meant to be used in a scriptable / programmatic way, as opposed
to human input. These APIs live in `@focusgrid/kcc-core`, `@focusgrid/kcc-dom`, and
`@focusgrid/kcc-react`.

```tsx
import {
  KeyboardControlledList,
  createDefaultKCLKeymap,
  useKCLController,
} from "@focusgrid/kcc-react";

const controller = useKCLController({
  itemCount: rows.length,
  orientation: "vertical",
});

const keymap = createDefaultKCLKeymap<Row>({
  onActivate: (ctx) => toggleRow(ctx.index),
  onEdit: (ctx) => editRow(ctx.index),
});
```

## Shared types

```ts
type KCLOrientation = "vertical" | "horizontal";

type KCLMoveDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "start"
  | "end";

type KCLControllerState = {
  activeIndex: number;
  itemCount: number;
  focused: boolean;
  orientation: KCLOrientation;
};

type KCLCellContext<T> = {
  index: number;
  isListFocused: boolean;
  isCellActive: boolean;
  data: T;
};

type KCLCellAction<T> = (ctx: KCLCellContext<T>) => void;
```

## `createKCLController(options?)`

```ts
createKCLController(options?: KCLControllerOptions): KCLController;

type KCLControllerOptions = {
  itemCount?: number;
  activeIndex?: number;
  focused?: boolean;
  orientation?: KCLOrientation;
  selectDefaultIndex?: (itemCount: number) => number;
};
```

Creates a keyboard-controlled collection controller. The controller owns active row
state, item count, focus state, and orientation. Empty lists use
`activeIndex: -1`; non-empty lists default to index `0` unless
`activeIndex` or `selectDefaultIndex` is provided.

## `controller.api.setActiveIndex(next)`

```ts
setActiveIndex(next: number | ((prev: number) => number)): boolean;
```

Sets the active row index, clamped to the current item count. It returns `true`
when state changes and `false` when the normalized index is unchanged.

## `controller.api.setItemCount(itemCount, selectDefaultIndex?)`

```ts
setItemCount(
  itemCount: number,
  selectDefaultIndex?: (itemCount: number) => number,
): boolean;
```

Updates the item count and reconciles the active index. If the list becomes
empty, the active index becomes `-1`. If a previously empty list becomes
non-empty, `selectDefaultIndex` chooses the initial row when provided.

## `controller.api.setFocused(focused)`

```ts
setFocused(focused: boolean): boolean;
```

Updates whether the list root is focused. `kcc-dom` calls this from root focus
and blur events; apps usually do not need to call it directly.

## `controller.api.setOrientation(orientation)`

```ts
setOrientation(orientation: KCLOrientation): boolean;
```

Sets whether movement commands use vertical or horizontal arrow semantics.
Vertical lists respond to up/down movement. Horizontal lists respond to
left/right movement.

## `controller.getState()`

```ts
getState(): KCLControllerState;
```

Returns the current controller state snapshot.

## `controller.getCellContext(index, data)`

```ts
getCellContext<T>(index: number, data: T): KCLCellContext<T>;
```

Builds the render/action context for one row. This is what
`KeyboardControlledList` passes to `renderCell`.

## `controller.subscribe(listener)`

```ts
subscribe(listener: () => void): () => void;
```

Subscribes to controller state changes. The returned function unsubscribes the
listener.

## `createDefaultKCLShortcuts()`

```ts
createDefaultKCLShortcuts(): KCLShortcutValues;
```

Returns editable shortcut values keyed by the default shortcut ids. This is
useful for shortcut preference UI.

## `createDefaultKCLKeymap(options?)`

```ts
createDefaultKCLKeymap<T>(options?: {
  overrides?: KCLShortcutOverrides;
  onActivate?: KCLCellAction<T>;
  onEdit?: KCLCellAction<T>;
}): KCLActionBinding<T>[];
```

Creates the default KCL keymap. `overrides` replace default sequences by
shortcut id. `onActivate` handles the logical row activation shortcut, and
`onEdit` handles the logical row edit shortcut.

Invalid or empty shortcut sequences are dropped when the keymap is resolved.

## `resolveKCLKeymap(bindings)`

```ts
resolveKCLKeymap<T>(
  bindings: readonly KCLActionBinding<T>[],
): KCLKeyBinding<T>[];
```

Converts KCL action bindings into shortcut-engine bindings. Most React apps use
`createDefaultKCLKeymap()` and let `kcc-dom` resolve the bindings internally.

## `KeyboardControlledList`

```tsx
<KeyboardControlledList
  controller={controller}
  keymap={keymap}
  direction="vertical"
  dataList={rows}
  renderCell={(ctx) => <Row data={ctx.data} active={ctx.isCellActive} />}
/>
```

React binding for a KCC list. It mounts the DOM controller, keeps item count and
orientation synced, renders each row with `role="option"`, and keeps
`aria-activedescendant` on the list root.

```ts
type KeyboardControlledListProps<T> = {
  controller: KCLController;
  keymap: readonly KCLActionBinding<T>[];
  direction: KCLOrientation;
  renderCell: (ctx: KCLCellContext<T>) => ReactNode;
  dataList: readonly T[];
  selectDefaultIndex?: (dataList: readonly T[] | undefined) => number;
  className?: string;
};
```

## `useKCLController(options?)`

```ts
useKCLController(options?: KCLControllerOptions): KCLController;
```

Creates one stable KCL controller for a React component instance.

## `useKCLControllerState(controller)`

```ts
useKCLControllerState(controller: KCLController): KCLControllerState;
```

Subscribes a React component to controller state using `useSyncExternalStore`.
