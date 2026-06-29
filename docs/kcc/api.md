# API

KCC APIs live in `@focusgrid/kcc-core`, `@focusgrid/kcc-dom`, and
`@focusgrid/kcc-react`.

The primary React model is one `KCCollection` root with inline receivers:

```tsx
import {
  KCCollection,
  KCItem,
  KCList,
  createDefaultKCCollectionKeymap,
  useKCController,
  type KCActionBinding,
} from "@focusgrid/kcc-react";

const controller = useKCController({ orientation: "vertical" });
const keymap = createDefaultKCCollectionKeymap();

const rowActions: KCActionBinding<Row>[] = [
  {
    sequence: "Space",
    command: "activate",
    action: (ctx) => toggleRow(ctx.id),
  },
];

<KCCollection controller={controller} keymap={keymap} direction="vertical">
  <KCItem id="compose">Compose</KCItem>
  <KCList
    dataList={rows}
    getItemId={(row) => row.id}
    customActionKeybinds={rowActions}
    renderCell={(ctx) => <RowView row={ctx.data} active={ctx.isItemActive} />}
  />
  <h2>Static heading</h2>
</KCCollection>;
```

Static children render normally and do not register navigable entries.

## Shared Types

```ts
type KCOrientation = "vertical" | "horizontal";
type KCMoveDirection = "up" | "down" | "left" | "right" | "start" | "end";

type KCControllerState = {
  activeItemId: string | null;
  activeIndex: number;
  itemCount: number;
  itemIds: readonly string[];
  focused: boolean;
  orientation: KCOrientation;
  wrapAround: boolean;
};

type KCActionContext<T = unknown> = {
  id: string;
  index: number;
  isCollectionFocused: boolean;
  isItemActive: boolean;
  data: T;
};

type KCActionBinding<T = unknown> = {
  sequence: KeySequence | string;
  action: KCItemAction<T> | KCLCommandAction;
  command?: KCLCommandName;
  preventDefault?: boolean;
  repeat?: boolean;
};
```

`KCL*` names remain exported as compatibility aliases where practical.
Compatibility contexts also include `isListFocused` and `isCellActive`.

## `createKCController(options?)`

```ts
createKCController(options?: KCControllerOptions): KCController;
```

Creates a keyboard-controlled collection controller. The controller tracks
registered item ids, the active item id, focus state, orientation, and
wrap-around behavior.

Important options:

- `activeItemId?: string | null`
- `itemIds?: readonly string[]`
- `orientation?: KCOrientation`
- `wrapAround?: boolean`
- `selectDefaultItemId?: (entries: readonly KCRegisteredEntry[]) => string | null`

Legacy `itemCount`, `activeIndex`, and `selectDefaultIndex` are still accepted.

## Controller APIs

```ts
controller.api.setActiveItemId(next: string | null): boolean;
controller.api.setActiveIndex(next: number | ((prev: number) => number)): boolean;
controller.api.setRegisteredEntries(
  entries: readonly KCRegisteredEntry[],
  selectDefaultItemId?: (entries: readonly KCRegisteredEntry[]) => string | null,
): boolean;
controller.api.setFocused(focused: boolean): boolean;
controller.api.setOrientation(orientation: KCOrientation): boolean;
controller.api.setWrapAround(wrapAround: boolean): boolean;
```

`activeItemId` is the public reconciliation anchor. When entries reorder, the
same id stays active and `activeIndex` is recomputed from the new flattened
order.

## Commands

```ts
controller.commands.moveActive(direction: KCMoveDirection, count?: number): boolean;
```

Movement is position-based, orientation-aware, skips disabled entries, and
updates `activeItemId`.

## `KCCollection`

```tsx
<KCCollection
  controller={controller}
  keymap={nativeKeymap}
  direction="vertical"
  wrapAround={false}
  selectDefaultItemId={(items) => items[0]?.id ?? null}
>
  {children}
</KCCollection>
```

`KCCollection` owns DOM focus, `aria-activedescendant`, the root keyboard
listener, native movement routing, registration order, and conflict validation.
Its `keymap` should contain native structural bindings such as arrow movement.

## `KCItem`

```tsx
<KCItem id="compose" customActionKeybinds={composeActions}>
  {(ctx) => <button aria-current={ctx.isItemActive}>Compose</button>}
</KCItem>
```

`KCItem` registers one navigable entry. `data` is optional and defaults to
`undefined`.

## `KCList`

```tsx
<KCList
  dataList={rows}
  getItemId={(row) => row.id}
  customActionKeybinds={rowActions}
  renderCell={(ctx) => <Row row={ctx.data} />}
/>
```

`KCList` registers one entry per row and inherits direction/default selection
from the parent collection. Prefer `getItemId` for dynamic data.

## Keymap Helpers

```ts
createDefaultKCCollectionKeymap(options?: {
  overrides?: KCLShortcutOverrides;
}): KCActionBinding[];
```

Creates native movement bindings only: arrows, `Home`, and `End`.

```ts
createDefaultKCLKeymap<T>(options?: {
  overrides?: KCLShortcutOverrides;
  onActivate?: KCLCellAction<T>;
  onEdit?: KCLCellAction<T>;
}): KCActionBinding<T>[];
```

Legacy helper that includes movement plus activate/edit callbacks. New
collection code should pass movement bindings to `KCCollection` and app actions
to `KCItem` or `KCList`.

## Compatibility Wrapper

`KeyboardControlledList` remains available and is implemented with
`KCCollection` plus `KCList`. New code should prefer the explicit collection API
for heterogeneous layouts.
