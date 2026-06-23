# Feature roadmap
Incomplete but a good guide nonetheless

## Base
- keyboard support
- resizing support
- withConfirmation hooks (actually, might want to let the client handle this.)
- programmatic layout control
  - wrapRoot(direction, side, sizes, preserveActivePane)
  - select(id)
  - swap(id?, direction)
  - swap(id1, id2)

## Programmatic control
- Split new panes with child components.

## KeyboardControlledList
- New component package; meant to be used inside a Pane
- List (vertical or horizontal) with hooks for moveLeft moveRight moveUp moveDown (up and down are disabled for horizontal lists; and vice versa)
- Not meant to be nested but take a list of child components
- Retain their own cursor (simply an index). Defaults to 0 but you can provide a function that calculates the default if you want
- Commands
  - moveUp
  - moveDown
  - moveLeft
  - moveRight
  - multipy(command) // meant to be used with moves
  - moveHalfPageUp // meant to be used with ctrl-u in vim
  - moveHalfPageDown // meant to be used with ctrl-d in vim
  - moveHalfPageLeft
  - moveHalfPageRight
  - moveToStart
  - moveToEnd
  - remove(index)
  - insert(index, component)
- internal focus state enables us to change UI (for example, the selected row color) depending on if the KCL is focused or not!

## Session support
still debating on whether this matters or not...
