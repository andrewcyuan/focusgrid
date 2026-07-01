export {
  KCController,
  clampActiveIndex,
  createKCActionContext,
  createKCController,
  doesDirectionApply,
  moveActiveIndex,
} from "./controller";
export type {
  KCActionContext,
  KCCommands,
  KCControllerApi,
  KCControllerOptions,
  KCControllerState,
  KCItemAction,
  KCListener,
  KCMoveDirection,
  KCOrientation,
  KCRegisteredEntry,
} from "./controller";

export {
  createDefaultKCCollectionKeymap,
  createDefaultKCShortcuts,
  defaultKCShortcutActions,
  resolveKCKeymap,
} from "./keymap";
export type {
  KCActionBinding,
  KCActionContextFor,
  KCCommandAction,
  KCCommandArgs,
  KCCommandName,
  KCDefaultShortcutAction,
  KCKeyBinding,
  KCResolvedAction,
  KCShortcutContext,
  KCShortcutId,
  KCShortcutOverrides,
  KCShortcutValues,
} from "./keymap";

export {
  createKeyStroke,
  normalizeKeyName,
  normalizeKeySequenceInput,
  parseKeySequence,
  parseKeyStroke,
  strokeToId,
  validateKeySequenceInput,
} from "@focusgrid/shortcut-engine";
export type {
  KeySequence,
  KeySequenceValidationResult,
  KeyStroke,
} from "@focusgrid/shortcut-engine";
