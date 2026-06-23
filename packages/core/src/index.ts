export { createWorkspace, Workspace } from "./workspace";
export type { CreateWorkspaceOptions, Listener } from "./workspace";

export {
  CommandRegistry,
  DEFAULT_PANE_RESIZE_DELTA_PX,
  createDefaultCommandRegistry,
} from "./commands/registry";
export type { PaneResizeCommandArgs } from "./commands/registry";
export type { CommandContext, CommandHandler } from "./commands/types";

export {
  buildLayoutIndex,
  closePane,
  collectPaneIds,
  findSplitNode,
  focusPane,
  focusPaneInDirection,
  resizeHandle,
  resizePane,
  splitPane,
} from "./layout/operations";
export { reducer } from "./layout/reducer";
export type { WorkspaceAction } from "./layout/reducer";
export { computeLayout } from "./layout/solver";
export { getMinimumSize } from "./layout/min-size";
export { deserializeWorkspace, serializeWorkspace } from "./layout/serialize";

export { createKeyStroke, normalizeKeyName, strokeToId } from "./keyboard/normalize";
export { parseKeySequence, parseKeyStroke } from "./keyboard/parser";
export { createTrie, KeyRouter } from "./keyboard/trie";
export type { KeyRouterOptions } from "./keyboard/trie";
export type {
  KeyBinding,
  KeyMatchResult,
  KeySequence,
  KeyStroke,
  ShortcutContext,
} from "./keyboard/keymap";

export type {
  ComputedHandle,
  ComputedLayout,
  ComputedPane,
  Direction,
  LayoutIndex,
  LayoutNode,
  NodeId,
  PaneFocusDirection,
  PaneId,
  PaneNode,
  PaneResizeDirection,
  Rect,
  SplitNode,
  WorkspaceState,
} from "./state";
