# Keyboard Controlled Components Plan

This document captures the planned transition from the current
`KeyboardControlledList` API to a broader keyboard-controlled components model.
The goal is to keep the deterministic focus and keyboard behavior already built
for KCL, while making the primitive composable enough for heterogeneous
production layouts such as an email client's left menu bar.

The current `KeyboardControlledList<T>` API works well for one homogeneous list.
It becomes awkward when a single keyboard-controlled surface contains static
content, buttons, several lists with different data types, headings, spacing,
and "more" controls. The new model should let those pieces compose in normal
React layout while still producing one deterministic keyboard navigation model.

## Plan 1: Rename Packages and Public API

### Goal

Rename the KCL surface from "keyboard controlled collection" to "keyboard controlled
components" so the public API matches the broader abstraction.

The current list API should become the simple list-shaped receiver inside a
larger collection model, rather than the top-level concept.

### Proposed Names

Package names:

```txt
@focusgrid/keyboard-controlled-components
@focusgrid/keyboard-controlled-components-dom
@focusgrid/keyboard-controlled-components-react
```

Shorter package names are also worth considering before publishing:

```txt
@focusgrid/kcc
@focusgrid/kcc-dom
@focusgrid/kcc-react
```

Public React components:

```ts
KeyboardControlledCollection -> KCCollection
KeyboardControlledList -> KCList
KeyboardControlledItem -> KCItem
KeyboardControlledStaticItem -> KCStaticItem
```

Controller/API names should follow the same prefix:

```ts
KCLController -> KCController
KCLControllerState -> KCControllerState
KCLActionBinding -> KCActionBinding
KCLCellContext -> KCItemContext
```

### Migration Shape

1. Introduce the new names as aliases first.
2. Keep the old package and exports working during the transition.
3. Move internal files and docs after the alias layer is stable.
4. Remove old names only before the first stable public release, or after a
   documented deprecation period if this has already shipped.

### Concrete Work

1. Add new package entrypoints.

   Either rename the existing packages:

   ```txt
   packages/kcc-core -> packages/kcc-core
   packages/kcc-dom -> packages/kcc-dom
   packages/kcc-react -> packages/kcc-react
   ```

   Or keep the file layout initially and expose renamed package names through
   package metadata and exports.

2. Update package names in:

   ```txt
   package.json
   pnpm-lock.yaml
   pnpm-workspace.yaml
   tsconfig.base.json
   vitest.config.ts
   docs
   README.md
   playground
   tests
   ```

3. Add export aliases before removing old symbols.

   Example:

   ```ts
   export {
     KeyboardControlledCollection,
     KeyboardControlledCollection as KCCollection,
     KeyboardControlledList,
     KeyboardControlledList as KCList,
   };
   ```

4. Rename docs after the API has the new names:

   ```txt
   docs/kcc -> docs/keyboardControlledComponents
   ```

5. Update playground examples to use the new names. The playground should show
   both a simple `KCList` and a heterogeneous `KCCollection` layout.

### Compatibility Concerns

- Existing KCL tests should continue to pass under alias exports before any
  deeper behavior changes.
- The current `KeyboardControlledList<T>` can remain as a compatibility wrapper
  over `KCCollection` plus `KCList`.
- Documentation should avoid implying that `KCList` owns the whole keyboard
  surface once `KCCollection` exists.

### Testing Plan

- Type tests or compile-time usage examples should verify old and new imports.
- Existing KCL core/dom/react tests should pass unchanged during the alias
  phase.
- Add a narrow regression test proving `KCList` remains usable as the simple
  homogeneous list case.

## Plan 2: Rearchitect Around `KCCollection`

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
- `selectDefaultIndex`
- `className`
- `wrapAround`

`KCCollection` owns:

- DOM focus on the collection root
- active item index or active item id
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

### Receiver Responsibilities

`KCItem` props:

```ts
type KCItemProps = {
  id?: string;
  className?: string;
  disabled?: boolean;
  customActionKeybinds?: readonly KCActionBinding[];
  children: ReactNode | ((ctx: KCItemContext) => ReactNode);
};
```

`KCList<T>` props:

```ts
type KCListProps<T> = {
  dataList: readonly T[];
  renderCell: (ctx: KCListCellContext<T>) => ReactNode;
  direction?: KCOrientation;
  selectDefaultIndex?: (dataList: readonly T[] | undefined) => number;
  className?: string;
  customActionKeybinds?: readonly KCActionBinding<T>[];
  getItemId?: (data: T, index: number) => string;
};
```

`KCList` can keep a `direction` prop for rendering and local semantics, but the
first implementation should treat list rows as inline entries in the parent
collection's active order.

### Actions

There should be no `onActivate` prop in the core component API.

Activation, editing, deletion, opening menus, and other application behavior
should be expressed through action bindings:

```ts
type KCActionBinding<T = unknown> = {
  sequence: KeySequence;
  action: KCItemAction<T>;
  preventDefault?: boolean;
};

type KCItemAction<T = unknown> = (ctx: KCActionContext<T>) => void;
```

For a `KCItem`, `ctx.data` is absent unless explicitly provided.

For a `KCList<T>` row, `ctx.data` is that row's domain value.

Native movement actions should remain separate from custom action bindings so
custom action bindings can be validated against structural navigation.

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
- Conflicts should throw or warn in development.
- Production behavior should be deterministic.
- Custom bindings in the same inline collection should not conflict unless a
  clear priority rule exists.
- Future contained scopes may reuse keys because scope entry changes the active
  routing context.

### State Reconciliation

The current controller uses `activeIndex`. That is enough for a homogeneous
list, but a composite collection should strongly consider stable item ids.

Recommended direction:

```ts
type KCControllerState = {
  activeItemId: string | null;
  activeIndex: number;
  itemCount: number;
  focused: boolean;
  orientation: KCOrientation;
};
```

`activeIndex` is useful for movement and compatibility. `activeItemId` is useful
when inboxes, labels, or static controls are inserted or removed.

If item ids are omitted, generated ids can preserve current behavior, but docs
should encourage stable ids for dynamic data.

### Implementation Phases

1. Move existing root focus and keyboard logic into a collection-shaped core.

   The current `KCLController`, `KCLDomController`, and React root behavior are
   already close to what `KCCollection` needs. The first change should be a
   structural relocation, not a rewrite.

2. Implement `KCItem` as the smallest receiver.

   It should register one entry, render children, receive active state, and run
   custom actions for that entry.

3. Rebuild `KCList<T>` as a receiver.

   It should map `dataList<T>` into a sequence of registered entries and keep
   the current render-cell ergonomics.

4. Add conflict validation.

   Validate custom action bindings against collection native bindings and
   duplicate custom bindings in the same inline scope.

5. Preserve old `KeyboardControlledList<T>`.

   Implement it as:

   ```tsx
   <KCCollection controller={controller} keymap={keymap} direction={direction}>
     <KCList
       dataList={dataList}
       renderCell={renderCell}
       selectDefaultIndex={selectDefaultIndex}
       className={className}
     />
   </KCCollection>
   ```

6. Update playground and docs.

   Add an email-sidebar example that proves heterogeneous layout, multiple data
   types, static content, and custom actions work together.

### Testing Plan

Core tests:

- movement across registered `KCItem` and `KCList` entries
- movement from one list into the next item after the list
- clamping at start/end
- `wrapAround`
- active item reconciliation when a registered list shrinks
- active item reconciliation by stable id when data changes
- custom action receives the correct item/list row context
- conflict validation rejects native/custom collisions

DOM tests:

- focus stays on the collection root
- `aria-activedescendant` follows active registered entries
- pointer click focuses the root and activates the clicked entry
- keyboard movement crosses `KCItem` and `KCList` boundaries
- editable descendants do not accidentally run collection shortcuts

React tests:

- `KCItem` registers one entry
- `KCList<T>` registers one entry per row
- non-KC children render but do not register entries
- dynamic insertion/removal preserves focus by stable id
- old `KeyboardControlledList<T>` compatibility wrapper behaves like before

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
