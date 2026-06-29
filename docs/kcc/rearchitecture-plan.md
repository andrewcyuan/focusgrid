## Rearchitect Around `KCCollection`

### Goal

Move the focus, active cursor, keyboard routing, ARIA root behavior, and native
navigation commands from `KeyboardControlledList` into `KCCollection`.

`KCList` should become a receiver that contributes a contiguous subset of
rendered items to the collection. `KCItem` should contribute one item.
Non-KC children should remain normal static React layout.

This lets layouts like the email sidebar be represented directly:

```tsx
<KCCollection controller={controller} keymap={keymap} direction="vertical">
  <Logo />

  <KCItem customActionKeybinds={composeActions}>
    <ComposeButton />
  </KCItem>

  <KCList
    dataList={inboxes}
    renderCell={(ctx) => <InboxRow inbox={ctx.data} />}
    customActionKeybinds={inboxActions}
  />

  <KCItem customActionKeybinds={inboxMoreActions}>
    <InboxesListMoreButton />
  </KCItem>

  <h2>Labels</h2>

  <KCItem customActionKeybinds={addLabelActions}>
    <AddLabelButton />
  </KCItem>

  <KCList
    dataList={labels}
    renderCell={(ctx) => <LabelRow label={ctx.data} />}
    customActionKeybinds={labelActions}
  />

  <KCItem customActionKeybinds={labelMoreActions}>
    <LabelsListMoreButton />
  </KCItem>
</KCCollection>
```

### Core Model

`KCCollection` owns one logical ordered collection of navigable entries.

`KCItem` registers one entry.

`KCList<T>` registers many entries, one per `dataList` row.

Static children do not register entries and are skipped by keyboard navigation.
They still render normally and can provide visual spacing, headings, separators,
or branding.

The collection should navigate flattened entries:

```txt
compose
inbox:primary
inbox:social
inbox:promotions
inboxes-more
add-label
label:work
label:personal
labels-more
```

This avoids giant union types, fake invisible panes, nested focus handoff, and
render switches over unrelated domain data.

### Provider Responsibilities

`KCCollection` provides:

- `controller`
- `keymap` for native structural navigation
- `direction`
- `selectDefaultItemId`
- `className`
- `wrapAround`

`KCCollection` owns:

- DOM focus on the collection root
- active item id as the public cursor identity
- internal item ordering for directional movement
- item count reconciliation
- native movement commands
- ARIA root attributes
- active descendant synchronization
- conflict validation between native keybinds and registered custom keybinds

The collection keymap should be limited to native structural behavior:

- move active item up/down/left/right
- move to start/end
- page movement if added
- possibly enter/exit contained child scopes later

Application behavior should live in action bindings, not `onActivate` props.

VERY IMPORTANT: we have already implemented the logic for KCCollection in KeyboardControlledList. This should be first a rename, then removing some capabilities, then finally converting to the provider structure (exposing controller and native keymap in a react useContext).

### Receiver Responsibilities

`KCItem` props:

```ts
type KCItemProps<T = undefined> = {
  id?: string;
  className?: string;
  disabled?: boolean;
  data?: T;
  customActionKeybinds?: readonly KCActionBinding<T>[];
  children: ReactNode | ((ctx: KCActionContext<T>) => ReactNode);
};
```

`KCList<T>` props:

```ts
type KCListProps<T> = {
  dataList: readonly T[];
  renderCell: (ctx: KCActionContext<T>) => ReactNode;
  className?: string;
  customActionKeybinds?: readonly KCActionBinding<T>[];
  getItemId?: (data: T, index: number) => string;
};
```

`KCList` should not accept its own `direction` in the first implementation.
Inline `KCList` rows inherit the parent `KCCollection` direction because they
are part of the same flattened traversal surface.

`KCList` should also not accept `selectDefaultIndex` in the first
implementation. Inline lists are part of one flattened collection, so a
list-local default selection is ambiguous. Default selection belongs to
`KCCollection`.

Because stable ids are the public item identity, the collection-level default
selection prop should be id-based:

```ts
selectDefaultItemId?: (items: readonly KCRegisteredEntry[]) => string | null;
```

The implementation can translate that id to an internal position after
registration order is known.

A per-list direction or per-list default selection implies a nested or contained
focus scope. For example, if the collection is vertical but one child list is
horizontal, arrow-key behavior has to decide whether vertical keys enter/leave
the list while horizontal keys move inside it. That is a different feature than
inline composition and should be deferred until contained scopes are
intentionally designed.

Default rule:

```txt
Inline KCList direction = parent KCCollection direction
Inline KCList default selection = parent KCCollection selectDefaultItemId
```

Future rule:

```txt
Contained KCList direction = explicit scope-local direction
Contained KCList default selection = explicit scope-local default selection
```

### Actions

Activation, editing, deletion, opening menus, and other application behavior
should be expressed through action bindings:

```ts
type KCActionBinding<T = unknown> = {
  sequence: KeySequence;
  action: KCItemAction<T>;
  preventDefault?: boolean;
};

type KCItemAction<T = unknown> = (ctx: KCActionContext<T>) => void;

type KCActionContext<T = unknown> = {
  id: string;
  isCollectionFocused: boolean;
  isItemActive: boolean;
  data: T;
};
```

`KCActionContext` should be the renamed successor to the current
`KCLCellContext`. It should keep the same basic shape of "active item plus
domain data", but use stable ids as the public item identity instead of exposing
indices as the primary contract.

For a `KCItem<T>`, `ctx.data` is the optional `data` prop. For a `KCItem`
without a `data` prop, `T` defaults to `undefined`.

For a `KCList<T>` row, `ctx.data` is that row's domain value.

Native movement actions should remain separate from custom action bindings so
custom action bindings can be validated against structural navigation.

Indices may still exist internally in core/dom to support ordered movement,
`aria-activedescendant` reconciliation, and efficient lookup, but public actions
should prefer stable ids. This avoids making application code depend on a row's
temporary position inside a changing composite collection.

`KCItem` and `KCList` should not install their own shortcut listeners in the
inline model. They register custom action bindings with the collection. The
collection's single keyboard listener determines which registered entry is
active and then routes matching custom actions for that entry.

Routing order:

1. Normalize the keyboard event at the `KCCollection` root.
2. Try native collection movement bindings first.
3. If a native binding matches, run the structural command and stop.
4. Find the active registered entry.
5. Resolve that entry's custom action bindings.
6. If a custom binding matches, run it with that entry's action context.

Native collection bindings always win over custom bindings.

### Focus Model

The default model should be one DOM focus owner:

```txt
DOM focus: KCCollection root
Logical focus: active registered item
```

`KCList` should not take over DOM focus by default. It contributes rows to the
parent collection. When movement reaches the end of one list, the parent simply
moves to the next registered item.

This is the right default for sidebars, menus, command palettes, file pickers,
and other composite but linear surfaces.

Individual `KCList` instances should also not own independent keydown listeners
in the inline model. A single DOM focus owner should imply a single keyboard
event capture point. This keeps event ordering, conflict validation, pending
multi-stroke shortcuts, and `preventDefault` behavior deterministic.

Nested focus should be a later explicit feature, not the baseline model.

Possible future scope modes:

```ts
type KCScopeMode = "inline" | "contained";
type KCBoundaryBehavior = "bubble" | "wrap" | "clamp" | "exit";
```

Initial implementation should support only inline registration unless a real
production example requires contained scopes.

### Registration Model

Avoid relying only on React child inspection. It fails when users wrap items in
custom components or fragments.

Prefer a context registry:

1. `KCCollection` creates a registration context.
2. `KCItem` registers one item on mount/update.
3. `KCList` registers one item per row on mount/update.
4. `KCCollection` builds the flattened navigation model from registered entries.
5. Each registered entry gets active state and row props from the collection.

The registry must preserve rendered order. If basic mount order is not reliable
enough for dynamic layouts, registered DOM nodes can be sorted by document order.

Registered entries should carry enough metadata for centralized action routing:

```ts
type KCRegisteredEntry<T = unknown> = {
  id: string;
  element: HTMLElement | null;
  disabled?: boolean;
  data: T;
  getActionKeybinds?: () => readonly KCActionBinding<T>[];
};
```

Every registered entry should have a stable id. `KCItem` can use its explicit
`id` prop or a generated id for static one-off controls. `KCList<T>` should
strongly encourage `getItemId` for dynamic data; generated index-based ids can
exist as a convenience, but docs should identify them as less stable when rows
are inserted, removed, or reordered.

`KCItem<T>` registers one entry and attaches its optional `data` prop to the
action context. `KCList<T>` registers one entry per row and attaches that row's
`T` value to the action context.

### ARIA Model

The current KCL `aria-activedescendant` model should move to `KCCollection`.

The collection root should own:

- `tabIndex`
- keyboard capture listener
- focused state
- `aria-activedescendant`
- orientation metadata

Registered navigable entries should receive:

- stable id
- selected/active attributes
- pointer handlers
- item metadata needed by action contexts

The exact ARIA role may need to be configurable. A sidebar could be closer to
`menu`, `navigation`, `tree`, or `listbox` depending on app semantics. The first
implementation can preserve the current listbox behavior, but the architecture
should not hard-code listbox forever.

### Conflict Validation

`KCCollection` should validate custom action keybinds registered by `KCItem` and
`KCList` against native structural keybinds.

Rules:

- Native collection bindings win.
- Conflicts should warn in development.
- Conflicts should also warn in production.
- Production behavior should be deterministic.
- Custom bindings in the same inline collection should warn when they conflict
  unless a clear priority rule exists.
- Future contained scopes may reuse keys because scope entry changes the active
  routing context.

### State Reconciliation

The current controller uses `activeIndex`. The composite collection should move
the public state model to stable item ids.

Recommended direction:

```ts
type KCControllerState = {
  activeItemId: string | null;
  itemCount: number;
  focused: boolean;
  orientation: KCOrientation;
};
```

`activeItemId` should be the public reconciliation anchor. It stays meaningful
when inboxes, labels, or static controls are inserted, removed, or reordered.

Core/dom may keep an internal active index or id-to-index lookup because ordered
movement still needs positions. That index should not be the main public action
contract.

Public imperative APIs should also be id-based:

```ts
setActiveItemId(next: string | null): boolean;
```

Movement commands can continue to operate directionally because they are
position-based by nature, but they should update `activeItemId` as the public
state result.

If item ids are omitted, generated ids can preserve simple static behavior, but
docs should encourage stable ids for dynamic data.

### Implementation Phases

1. Move existing root focus and keyboard logic into a collection-shaped core.

   The current `KCLController`, `KCLDomController`, and React root behavior are
   already close to what `KCCollection` needs. The first change should be a
   structural relocation, not a rewrite.

2. Implement `KCItem` as the smallest receiver.

   It should register one entry, render children, receive active state, and
   expose custom actions to the collection. It should not install a shortcut
   listener.

3. Rebuild `KCList<T>` as a receiver.

   It should map `dataList<T>` into a sequence of registered entries and keep
   the current render-cell ergonomics. It should inherit `direction` and
   default selection from the parent collection and should not install a
   shortcut listener.

4. Add conflict validation.

   Validate custom action bindings against collection native bindings and
   duplicate custom bindings in the same inline scope.

5. Update playground and docs.

   Add an email-sidebar example that proves heterogeneous layout, multiple data
   types, static content, and custom actions work together.

### Testing Plan

Core tests:

- movement across registered `KCItem` and `KCList` entries
- movement from one list into the next item after the list
- clamping at start/end
- `wrapAround`
- list rows inherit parent collection direction
- active item reconciliation when a registered list shrinks
- active item reconciliation by stable id when data changes
- custom action receives the correct item/list row context
- conflict validation warns for native/custom collisions
- native movement bindings win over registered custom bindings

DOM tests:

- focus stays on the collection root
- keyboard events are handled by the collection root listener, not per-list
  listeners
- `aria-activedescendant` follows active registered entries
- pointer click focuses the root and activates the clicked entry
- keyboard movement crosses `KCItem` and `KCList` boundaries
- editable descendants do not accidentally run collection shortcuts

React tests:

- `KCItem` registers one entry
- `KCList<T>` registers one entry per row
- non-KC children render but do not register entries
- dynamic insertion/removal preserves focus by stable id

Browser regression tests:

- email sidebar fixture with logo, compose button, inbox list, more button,
  labels heading, add label button, labels list, and labels more button
- focus starts at the selected default item
- arrow keys move deterministically through every navigable item
- static heading and logo are skipped
- custom action keybindings operate on inbox rows and label rows with their
  separate data types

### Non-Goals For First Pass

- Nested contained KCC scopes
- Virtualized collections
- Grid/table two-dimensional navigation
- Full ARIA role abstraction for every composite widget
- Drag/reorder behavior
- Type-level proof that no custom action keybind conflicts can exist

These may become important later, but the first production pressure is
heterogeneous composition inside one keyboard-controlled surface.
