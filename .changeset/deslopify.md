---
"@andrewcyuan/focusgrid": minor
"@andrewcyuan/shortcut-engine": minor
---

Breaking changes:

- Shortcut engine: remove `createShortcutEngine` (use `new ShortcutEngine()`) and the `repeatTimeoutMs` and `now` options. The repeat window is a fixed 500ms. `ShortcutScopeContext`, `ShortcutScopeProps`, and `SequenceState` are no longer exported.
- Focusgrid React: `useFocusGridController(createProps)` creates both controllers and returns `{ controller, domController }`.
- The default pane keymap uses a `Ctrl-S` prefix with tmux-style bindings: `Ctrl-S |` and `Ctrl-S -` split, `Ctrl-S X` closes, `Ctrl-H/J/K/L` move focus, and `Ctrl-Shift-H/J/K/L` resize. `createDefaultPaneKeymap` accepts custom sequences.

Fixes:

- Splits that would make a pane smaller than `minWidth` or `minHeight` now do nothing.
- The active pane outline shows only while the grid has browser focus.
