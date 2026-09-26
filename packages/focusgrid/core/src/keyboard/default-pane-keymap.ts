import { type ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import type { FocusGridController } from "../controller";

export const defaultPaneShortcutActions = [
  {
    id: "split-right",
    label: "Split right",
    action: (controller: FocusGridController) => controller.splitActive("right"),
    defaultSequence: "Ctrl-B %",
  },
  {
    id: "split-down",
    label: "Split down",
    action: (controller: FocusGridController) => controller.splitActive("down"),
    defaultSequence: "Ctrl-B \"",
  },
  {
    id: "close",
    label: "Close active",
    action: (controller: FocusGridController) => controller.removeActive(),
    defaultSequence: "Ctrl-B X",
  },
  {
    id: "focus-left",
    label: "Focus left",
    action: (controller: FocusGridController) => controller.focusAdjacent("left"),
    defaultSequence: "Ctrl-B Left",
  },
  {
    id: "focus-right",
    label: "Focus right",
    action: (controller: FocusGridController) => controller.focusAdjacent("right"),
    defaultSequence: "Ctrl-B Right",
  },
  {
    id: "focus-up",
    label: "Focus up",
    action: (controller: FocusGridController) => controller.focusAdjacent("up"),
    defaultSequence: "Ctrl-B Up",
  },
  {
    id: "focus-down",
    label: "Focus down",
    action: (controller: FocusGridController) => controller.focusAdjacent("down"),
    defaultSequence: "Ctrl-B Down",
  },
  {
    id: "swap-left",
    label: "Swap left",
    action: (controller: FocusGridController) => controller.swapAdjacent("left"),
    defaultSequence: "Ctrl-B Shift-Left",
  },
  {
    id: "swap-right",
    label: "Swap right",
    action: (controller: FocusGridController) => controller.swapAdjacent("right"),
    defaultSequence: "Ctrl-B Shift-Right",
  },
  {
    id: "swap-up",
    label: "Swap up",
    action: (controller: FocusGridController) => controller.swapAdjacent("up"),
    defaultSequence: "Ctrl-B Shift-Up",
  },
  {
    id: "swap-down",
    label: "Swap down",
    action: (controller: FocusGridController) => controller.swapAdjacent("down"),
    defaultSequence: "Ctrl-B Shift-Down",
  },
  {
    id: "resize-left",
    label: "Resize left",
    action: (controller: FocusGridController) => controller.resizeActive("left", 48),
    defaultSequence: "Ctrl-B H",
    repeat: true,
  },
  {
    id: "resize-right",
    label: "Resize right",
    action: (controller: FocusGridController) => controller.resizeActive("right", 48),
    defaultSequence: "Ctrl-B L",
    repeat: true,
  },
  {
    id: "resize-up",
    label: "Resize up",
    action: (controller: FocusGridController) => controller.resizeActive("up", 48),
    defaultSequence: "Ctrl-B K",
    repeat: true,
  },
  {
    id: "resize-down",
    label: "Resize down",
    action: (controller: FocusGridController) => controller.resizeActive("down", 48),
    defaultSequence: "Ctrl-B J",
    repeat: true,
  },
] as const;

export type PaneShortcutId = (typeof defaultPaneShortcutActions)[number]["id"];
export type PaneShortcutValues = Record<PaneShortcutId, string>;

export function createDefaultPaneShortcuts(): PaneShortcutValues {
  return Object.fromEntries(defaultPaneShortcutActions.map(action => [action.id, action.defaultSequence])) as PaneShortcutValues;
}

export function createDefaultPaneKeymap(controller: FocusGridController): ShortcutBinding[] {
  return defaultPaneShortcutActions.map(definition => ({
    sequence: definition.defaultSequence,
    action: () => { definition.action(controller); },
    repeat: "repeat" in definition ? definition.repeat : undefined,
  }));
}
