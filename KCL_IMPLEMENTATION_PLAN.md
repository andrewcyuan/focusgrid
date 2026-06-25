# KeyboardControlledList Implementation Plan

## Information

Component package for deterministic keyboard navigation inside a pane.
It should be useful for command palettes, file lists, tabs, results panes, and
other list-like UI.

### Shape

- [ ] Vertical or horizontal orientation.
- [ ] Controlled active item state: `activeIndex` plus a setter.
- [ ] Optional callback to run an action for a row: `(row) => void`.
- [ ] Internal focus state so the list can style active rows differently when the
  list itself is focused.
- [ ] Not intended for deeply nested lists at first.

### API

- [ ] `moveFocus(direction | 'start' | 'end' | 'middle')`
- [ ] `moveFocusBy(direction, increment)`
  - truncates, does not overflow when hitting / going past end.
- [ ] `remove(index)`
- [ ] `insert(index, component)`
- [ ] `swapForward(index1, index2)`

### Commands
- moveFocus.Up, moveFocus.Down, moveFocus.Left, moveFocus.Right
- moveFocusBy.Up, moveFocusBy.Down, moveFocusBy.Left, moveFocusBy.Right
  - argument: multiply
- moveFocusHalfPage.Up, moveFocusHalfPage.Down, moveFocusHalfPage.Left, moveFocusHalfPage.Right
- remove
- insert.Above, insert.Below
  - argument: data object of type T
- swapCell.Forward, swapCell.Backward

### Ideal react usage
```tsx
type KCLProviderProps = {
  keymap: KeymapBinding[],
  config: any,
}

type KCLCellContext<T> = {
  index: number,
  isKCLFocused: boolean,
  isCellSelected: boolean,
  data: T,
}
type KCLProps<T> = {
  direction: 'vertical' | 'horizontal'
  renderCell: (ctx: KCLCellContext) => ReactNode
  dataList: T[],
  selectDefaultIndex?: (dataList: T[] | undefined) => number, // only used on mount / rerender; defaults to () => 0
  keymapOverride?: KeymapBinding[],
  actionCallback: (ctx: KCLCellContext) => void
}

// email example
<KeyboardControlledListProvider
  keymap={keymap}
  config={config} // tbd just make a raw json object for now
>
  {/* some other code... */}

  <KeyboardControlledList
    keymapOverride={keymap}
    renderCell={renderEmailRow}
    dataList={emailRows}
    selectDefaultIndex={() => 0} // just use the first one
    actionCallback={openEmail}
    />

  {/* some other code... */}
</KeyboardControlledListProvider>
```


## Phase 1: Package skeleton

[ ] Create packages `packages/kcl-core` and `packages/kcl-react`. All the main logic is in core. `kcl-react` defines a wrapper with a simple provider/root pattern, very similar to focusgrid.
[ ] Export a small public surface from `src/index.ts`.
[ ] Add package-local `test/` coverage and wire `build`, `typecheck`, and `test`
  scripts using the existing package conventions.
[ ] In the playground, make a route `/kcl` which is a duplicate of the main playground, but with KCLs instead of textboxes. (and different sidebar options obvs)

## Phase 2: Core API

[ ] Implement the core features: 
  - keyboard listeners (copy focusgrid implementation + conventions using tinykeys. ok to duplicate some code here.)
  - internal tracking of cursor
  - Implementation of API
    - moveFocus
    - moveFocusBy
    - remove
    - insert
    - swap
[ ] Testing suite for API

## Phase 3: Focus and DOM contract

[ ] DOM logic: receiving focus, switching focus, etc. I need your help with this because I don't understand it that well.
  [ ] Make the list itself focusable and expose focused state to rows.
  [ ] Use predictable ARIA roles and attributes for listbox-style navigation.
  [ ] Ensure pointer interaction can focus/select rows without breaking keyboard
    behavior.
  [ ] Add browser-oriented tests that assert `document.activeElement`, active row
    state, and DOM attributes.
[ ] playwright tests; if applicable
[ ] Playground: for now, you can envision the kcl as todo list. so the cells are rows with some text and a checkbox. client code: let the user hit enter when focusing a cell to check it and cross out the text!


## Phase 4: Navigation commands

[ ] Implement all commands
  [ ] Map vertical and horizontal orientation deliberately so irrelevant directions
    do not unexpectedly move selection.
  [ ] Clamp movement at list boundaries.
[ ] Add tests for empty lists, single-item lists, disabled movement directions,
  and boundary behavior.

## Phase 5: Action callback

[ ] Add an optional row action callback, triggered by `Enter` and pointer
  activation.
[ ] Pass the item and index to the callback.
[ ] Assert that activation does not mutate active index unless the app does so
  through controlled props.


## General

Update this file as each change lands!
