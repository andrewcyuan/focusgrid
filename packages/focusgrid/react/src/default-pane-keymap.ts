import { type ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import type { FocusGridController } from "@andrewcyuan/focusgrid/core";

type PaneShortcutAction = {
  id: string;
  label: string;
  action: (controller: FocusGridController) => unknown;
  defaultSequence: string;
  repeat?: boolean;
};

export const defaultPaneShortcutActions = [
  {
    id: "split-right",
    label: "Split right",
    action: (controller) => controller.splitActive("right"),
    defaultSequence: "Ctrl-S |",
  },
  {
    id: "split-down",
    label: "Split down",
    action: (controller) => controller.splitActive("down"),
    defaultSequence: "Ctrl-S -",
  },
  {
    id: "close",
    label: "Close active",
    action: (controller) => controller.removeActive(),
    defaultSequence: "Ctrl-S X",
  },
  {
    id: "focus-left",
    label: "Focus left",
    action: (controller) => controller.focusAdjacent("left"),
    defaultSequence: "Ctrl-H",
  },
  {
    id: "focus-right",
    label: "Focus right",
    action: (controller) => controller.focusAdjacent("right"),
    defaultSequence: "Ctrl-L",
  },
  {
    id: "focus-up",
    label: "Focus up",
    action: (controller) => controller.focusAdjacent("up"),
    defaultSequence: "Ctrl-K",
  },
  {
    id: "focus-down",
    label: "Focus down",
    action: (controller) => controller.focusAdjacent("down"),
    defaultSequence: "Ctrl-J",
  },
  {
    id: "swap-left",
    label: "Swap left",
    action: (controller) => controller.swapAdjacent("left"),
    defaultSequence: "Ctrl-S Shift-Left",
  },
  {
    id: "swap-right",
    label: "Swap right",
    action: (controller) => controller.swapAdjacent("right"),
    defaultSequence: "Ctrl-S Shift-Right",
  },
  {
    id: "swap-up",
    label: "Swap up",
    action: (controller) => controller.swapAdjacent("up"),
    defaultSequence: "Ctrl-S Shift-Up",
  },
  {
    id: "swap-down",
    label: "Swap down",
    action: (controller) => controller.swapAdjacent("down"),
    defaultSequence: "Ctrl-S Shift-Down",
  },
  {
    id: "resize-left",
    label: "Resize left",
    action: (controller) => controller.resizeActive("left", 48),
    defaultSequence: "Ctrl-Shift-H",
    repeat: true,
  },
  {
    id: "resize-right",
    label: "Resize right",
    action: (controller) => controller.resizeActive("right", 48),
    defaultSequence: "Ctrl-Shift-L",
    repeat: true,
  },
  {
    id: "resize-up",
    label: "Resize up",
    action: (controller) => controller.resizeActive("up", 48),
    defaultSequence: "Ctrl-Shift-K",
    repeat: true,
  },
  {
    id: "resize-down",
    label: "Resize down",
    action: (controller) => controller.resizeActive("down", 48),
    defaultSequence: "Ctrl-Shift-J",
    repeat: true,
  },
] as const satisfies readonly PaneShortcutAction[];

export type PaneShortcutId = (typeof defaultPaneShortcutActions)[number]["id"];
export type PaneShortcutValues = Record<PaneShortcutId, string>;

export function createDefaultPaneShortcuts(): PaneShortcutValues {
  return Object.fromEntries(
    defaultPaneShortcutActions.map((action) => [action.id, action.defaultSequence]),
  ) as PaneShortcutValues;
}

export function createDefaultPaneKeymap(
  controller: FocusGridController,
  shortcuts: PaneShortcutValues = createDefaultPaneShortcuts(),
): ShortcutBinding[] {
  return defaultPaneShortcutActions.map((definition) => ({
    sequence: shortcuts[definition.id],
    action: () => {
      definition.action(controller);
    },
    repeat: "repeat" in definition && definition.repeat,
  }));
}
