export { createWorkspace, Workspace } from "./workspace";
export type {
  CreateWorkspaceOptions,
  Listener,
  PaneDefaults,
  WorkspaceApi,
} from "./workspace";

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
  findPaneInDirection,
  focusPane,
  focusPaneInDirection,
  removePane,
  resizeHandle,
  resizePane,
  splitPane,
  swapPaneInDirection,
  swapPanes,
  wrapRootInSplit,
} from "./layout/operations";
export type {
  PaneSplitSide,
  ResizePaneOptions,
  SplitPaneOptions,
  WrapRootInSplitOptions,
} from "./layout/operations";
export { reducer } from "./layout/reducer";
export type { WorkspaceAction } from "./layout/reducer";
export { computeLayout } from "./layout/solver";
export { getMinimumSize } from "./layout/min-size";
export { deserializeWorkspace, serializeWorkspace } from "./layout/serialize";

export { createKeyStroke, normalizeKeyName, strokeToId } from "./keyboard/normalize";
export { parseKeySequence, parseKeyStroke } from "./keyboard/parser";
export {
  createDefaultPaneKeymap,
  defaultPaneShortcutActions,
} from "./keyboard/default-pane-keymap";
export type {
  DefaultPaneCommand,
  PaneShortcutAction,
  PaneShortcutId,
} from "./keyboard/default-pane-keymap";
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
  PaneSwapDirection,
  Rect,
  SplitNode,
  WorkspaceState,
} from "./state";
