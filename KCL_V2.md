# KCL implementation plan

New paradigm:
KCL owns the active index / cursor.
Cell actions (defined by the client) taken are effected on the active cell at that moment.

Focus lives on list root; and row activity is done with aria list.
Root receives DOM focus. The active row is exposed and keyboard-controllable
with `aria-activedescendant`.


## shortcut-engine
New package that rips out the shortcut detection logic from focusgrid.

1. listens for given KeySequence[] and lets others fall through
2. routes matched key sequences to typed action results / handlers, without
   owning focusgrid or KCL-specific command execution
3. exposes strongly typed sdk for parsing strings into KeySequence and KeySequence types


## API + Command surface

### API
```ts
class KCLApi() {
  setActiveIndex(next: number)
  setActiveIndex(updater: (prev: number) => number)
}
```

### Command surface
```ts
class KCLCommands() {
  moveActive(direction, count?)
}
```

## client types
```ts
class KCLController() {
  constructor(keymap: KCLShortcutAction)

  public api: KCLApi
  public command: KCLCommands
}

type KCLCellContext<T> = {
  index: number
  isListFocused: boolean
  isCellActive: boolean
  data: T
}

type KCLCellAction<T> = (ctx: KCLCellContext) => void

type KCLActionBinding<T> = {
  sequence: KeySequence
  action: KCLCellAction<T> | keyof KCLCommands
  preventDefault?: boolean // default to true
}

type KCLProps<T> = {
  controller: KCLController
  keymap: KCLActionBinding[]
  direction: 'vertical' | 'horizontal'
  renderCell: (ctx: KCLCellContext) => ReactNode
  dataList: T[]
  selectDefaultIndex?: (dataList: T[] | undefined) => number // only used on mount / rerender; defaults to () => 0
}
```

## Client Usage
```tsx
// email example
<KeyboardControlledList
  controller={controller}
  keymap={keymap}
  direction='vertical'
  renderCell={renderEmailRow}
  dataList={emailRows}
  selectDefaultIndex={() => 0} // just use the first one
  />
```
