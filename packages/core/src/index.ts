export { createWorkspace, Workspace } from "./workspace";
export type { CreateWorkspaceOptions, Listener } from "./workspace";

export { CommandRegistry, createDefaultCommandRegistry } from "./commands/registry";
export type { CommandContext, CommandHandler } from "./commands/types";

export {
  buildLayoutIndex,
  closePane,
  collectPaneIds,
  findSplitNode,
  focusPane,
  resizeHandle,
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
  PaneId,
  PaneNode,
  Rect,
  SplitNode,
  WorkspaceState,
} from "./state";
