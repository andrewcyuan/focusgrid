# KCL implementation plan

KCL (keyboard controllable list) is a web library to make it easy to build keyboard-controlled lists for things like command palettes, file trees, etc. This library abstracts away the annoying parts of keyboard shortcut binding, handling DOM focus and ARIA so that clients can simply define the components and actions they want to happen.

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

## Package responsibilities

KCL should keep as much behavior as possible in `kcl-core` and `kcl-dom`.
`kcl-core` owns framework-agnostic state, typed command surfaces, keymap/action
contracts, and list behavior. `kcl-dom` owns browser-specific concerns like DOM
focus, keyboard event capture, ARIA wiring, and translating browser events into
the core SDK.

Framework packages such as `kcl-react` should be thin bindings over those typed
SDKs. They should adapt framework lifecycle and rendering APIs to the core and
DOM packages, without becoming the place where KCL behavior lives. This keeps it
straightforward to add another web framework binding later, such as
`kcl-svelte`, by reusing the same strongly typed core and DOM contracts.

## Playground

Make `/kcl` route on playground which is a copy of the main playground, but with KCLs with some sample actions instead of textboxes. And the sidebar panel will have different settings to control the KCLs.
