import type { KeyBinding } from "./keymap";
import { validateKeySequenceInput } from "./parser";

export type DefaultPaneCommand =
  | "pane.splitRight"
  | "pane.splitDown"
  | "pane.close"
  | "pane.focusLeft"
  | "pane.focusRight"
  | "pane.focusUp"
  | "pane.focusDown"
  | "pane.swapLeft"
  | "pane.swapRight"
  | "pane.swapUp"
  | "pane.swapDown"
  | "pane.resizeLeft"
  | "pane.resizeRight"
  | "pane.resizeUp"
  | "pane.resizeDown";

export type PaneShortcutAction<
  TCommand extends DefaultPaneCommand = DefaultPaneCommand,
> = {
  id: string;
  label: string;
  command: TCommand;
  defaultSequence: string;
  args?: unknown;
  repeat?: boolean;
};

export const defaultPaneShortcutActions = [
  {
    id: "split-right",
    label: "Split right",
    command: "pane.splitRight",
    defaultSequence: "Ctrl-B %",
  },
  {
    id: "split-down",
    label: "Split down",
    command: "pane.splitDown",
    defaultSequence: "Ctrl-B \"",
  },
  {
    id: "close",
    label: "Close active",
    command: "pane.close",
    defaultSequence: "Ctrl-B X",
  },
  {
    id: "focus-left",
    label: "Focus left",
    command: "pane.focusLeft",
    defaultSequence: "Ctrl-B Left",
  },
  {
    id: "focus-right",
    label: "Focus right",
    command: "pane.focusRight",
    defaultSequence: "Ctrl-B Right",
  },
  {
    id: "focus-up",
    label: "Focus up",
    command: "pane.focusUp",
    defaultSequence: "Ctrl-B Up",
  },
  {
    id: "focus-down",
    label: "Focus down",
    command: "pane.focusDown",
    defaultSequence: "Ctrl-B Down",
  },
  {
    id: "swap-left",
    label: "Swap left",
    command: "pane.swapLeft",
    defaultSequence: "Ctrl-B Shift-Left",
  },
  {
    id: "swap-right",
    label: "Swap right",
    command: "pane.swapRight",
    defaultSequence: "Ctrl-B Shift-Right",
  },
  {
    id: "swap-up",
    label: "Swap up",
    command: "pane.swapUp",
    defaultSequence: "Ctrl-B Shift-Up",
  },
  {
    id: "swap-down",
    label: "Swap down",
    command: "pane.swapDown",
    defaultSequence: "Ctrl-B Shift-Down",
  },
  {
    id: "resize-left",
    label: "Resize left",
    command: "pane.resizeLeft",
    defaultSequence: "Ctrl-B H",
    args: { deltaPx: 48 },
    repeat: true,
  },
  {
    id: "resize-right",
    label: "Resize right",
    command: "pane.resizeRight",
    defaultSequence: "Ctrl-B L",
    args: { deltaPx: 48 },
    repeat: true,
  },
  {
    id: "resize-up",
    label: "Resize up",
    command: "pane.resizeUp",
    defaultSequence: "Ctrl-B K",
    args: { deltaPx: 48 },
    repeat: true,
  },
  {
    id: "resize-down",
    label: "Resize down",
    command: "pane.resizeDown",
    defaultSequence: "Ctrl-B J",
    args: { deltaPx: 48 },
    repeat: true,
  },
] as const satisfies readonly PaneShortcutAction[];

export type PaneShortcutId = (typeof defaultPaneShortcutActions)[number]["id"];
export type PaneShortcutOverrides = Partial<Record<PaneShortcutId, string>>;
export type PaneShortcutValues = Record<PaneShortcutId, string>;
export type CreateDefaultPaneKeymapOptions = {
  overrides?: PaneShortcutOverrides;
};

export function createDefaultPaneShortcuts(): PaneShortcutValues {
  return Object.fromEntries(
    defaultPaneShortcutActions.map((action) => [
      action.id,
      action.defaultSequence,
    ]),
  ) as PaneShortcutValues;
}

export function createDefaultPaneKeymap(
  options: CreateDefaultPaneKeymapOptions = {},
): KeyBinding[] {
  const shortcuts = options.overrides ?? {};

  return defaultPaneShortcutActions.flatMap((action) => {
    const sequence = (shortcuts[action.id] ?? action.defaultSequence).trim();
    const args = "args" in action ? action.args : undefined;
    const repeat = "repeat" in action ? action.repeat : undefined;

    if (!sequence) {
      return [];
    }

    const validation = validateKeySequenceInput(sequence);

    if (!validation.ok) {
      return [];
    }

    return [
      {
        sequence: validation.sequence,
        command: action.command,
        args,
        preventDefault: true,
        repeat,
      },
    ];
  });
}
