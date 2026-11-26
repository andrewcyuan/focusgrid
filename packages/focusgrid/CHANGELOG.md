# @andrewcyuan/focusgrid

## 0.3.2

### Patch Changes

- Republish focusgrid so its packed dependency on `@andrewcyuan/shortcut-engine` resolves to the current `0.4.x` line. Previous releases shipped with a stale lockfile that pinned shortcut-engine to `0.2.0`, which caused duplicate engine instances when consumers installed shortcut-engine alongside focusgrid.

## 0.3.1

### Patch Changes

- Updated dependencies [5dc2696]
  - @andrewcyuan/shortcut-engine@0.4.0

## 0.3.0

### Minor Changes

- efa5ad6: Breaking changes:

  - Shortcut engine: remove `createShortcutEngine` (use `new ShortcutEngine()`) and the `repeatTimeoutMs` and `now` options. The repeat window is a fixed 500ms. `ShortcutScopeContext`, `ShortcutScopeProps`, and `SequenceState` are no longer exported.
  - Focusgrid React: `useFocusGridController(createProps)` creates both controllers and returns `{ controller, domController }`.
  - The default pane keymap uses a `Ctrl-S` prefix with tmux-style bindings: `Ctrl-S |` and `Ctrl-S -` split, `Ctrl-S X` closes, `Ctrl-H/J/K/L` move focus, and `Ctrl-Shift-H/J/K/L` resize. `createDefaultPaneKeymap` accepts custom sequences.

  Fixes:

  - Splits that would make a pane smaller than `minWidth` or `minHeight` now do nothing.
  - The active pane outline shows only while the grid has browser focus.

### Patch Changes

- e91908c: Use zero-specificity `:where(...)` CSS defaults so ordinary consumer class selectors override them regardless of stylesheet order, including active, hover, and focus-visible states. Add `--focusgrid-handle-idle-color` for the idle divider background, preserving its transparent default.
- Updated dependencies [efa5ad6]
  - @andrewcyuan/shortcut-engine@0.3.0

## 0.2.0

### Minor Changes

- README update

### Patch Changes

- Updated dependencies
  - @andrewcyuan/shortcut-engine@0.2.0
