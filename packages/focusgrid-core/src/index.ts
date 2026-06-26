export { createFocusGridController, FocusGridController } from "./controller";
export type {
  CreateFocusGridControllerOptions,
  Listener,
  PaneDefaults,
  FocusGridControllerApi,
} from "./controller";

export {
  CommandRegistry,
  DEFAULT_PANE_RESIZE_DELTA_PX,
  createDefaultCommandRegistry,
} from "./commands/registry";
export type { PaneResizeCommandArgs } from "./commands/registry";
export type { CommandContext, CommandHandler } from "./commands/types";

export {
  cardinalDirections,
  paneFocusDirections,
  paneResizeDirections,
  paneSplitSides,
  paneSwapDirections,
} from "./layout/types";
export type {
  ResizePaneOptions,
  SplitPaneOptions,
  WrapRootInSplitOptions,
} from "./layout/operations";
export {
  deserializeFocusGridControllerState,
  serializeFocusGridControllerState,
} from "./layout/serialize";

export {
  createKeyStroke,
  normalizeKeyName,
  strokeToId,
  normalizeKeySequenceInput,
  parseKeySequence,
  parseKeyStroke,
  validateKeySequenceInput,
} from "@focusgrid/shortcut-engine";
export type {
  KeySequence,
  KeySequenceValidationResult,
  KeyStroke,
  ShortcutBinding,
} from "@focusgrid/shortcut-engine";
export {
  createDefaultPaneKeymap,
  createDefaultPaneShortcuts,
  defaultPaneShortcutActions,
} from "./keyboard/default-pane-keymap";
export type {
  DefaultPaneCommand,
  CreateDefaultPaneKeymapOptions,
  PaneShortcutAction,
  PaneShortcutId,
  PaneShortcutOverrides,
  PaneShortcutValues,
  KeyBinding,
  ShortcutContext,
} from "./keyboard/default-pane-keymap";

export type {
  ComputedHandle,
  ComputedLayout,
  ComputedPane,
  CardinalDirection,
  Direction,
  LayoutIndex,
  LayoutNode,
  NodeId,
  PaneFocusDirection,
  PaneId,
  PaneNode,
  PaneResizeDirection,
  PaneSplitSide,
  PaneSwapDirection,
  Rect,
  SplitNode,
  FocusGridControllerState,
} from "./state";
