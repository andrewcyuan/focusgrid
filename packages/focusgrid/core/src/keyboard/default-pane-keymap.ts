import { type ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import type { FocusGridController } from "../controller";
import { splitActivePane, closeActivePane, focusAdjacentPane, swapAdjacentPane, resizeActivePane } from "../commands/pane-commands";

export const defaultPaneShortcutActions = [
  {
    id: "split-right",
    label: "Split right",
    action: (controller: FocusGridController) => splitActivePane(controller, "right"),
    defaultSequence: "Ctrl-B %",
  },
  {
    id: "split-down",
    label: "Split down",
    action: (controller: FocusGridController) => splitActivePane(controller, "down"),
    defaultSequence: "Ctrl-B \"",
  },
  {
    id: "close",
    label: "Close active",
    action: (controller: FocusGridController) => closeActivePane(controller),
    defaultSequence: "Ctrl-B X",
  },
  {
    id: "focus-left",
    label: "Focus left",
    action: (controller: FocusGridController) => focusAdjacentPane(controller, "left"),
    defaultSequence: "Ctrl-B Left",
  },
  {
    id: "focus-right",
    label: "Focus right",
    action: (controller: FocusGridController) => focusAdjacentPane(controller, "right"),
    defaultSequence: "Ctrl-B Right",
  },
  {
    id: "focus-up",
    label: "Focus up",
    action: (controller: FocusGridController) => focusAdjacentPane(controller, "up"),
    defaultSequence: "Ctrl-B Up",
  },
  {
    id: "focus-down",
    label: "Focus down",
    action: (controller: FocusGridController) => focusAdjacentPane(controller, "down"),
    defaultSequence: "Ctrl-B Down",
  },
  {
    id: "swap-left",
    label: "Swap left",
    action: (controller: FocusGridController) => swapAdjacentPane(controller, "left"),
    defaultSequence: "Ctrl-B Shift-Left",
  },
  {
    id: "swap-right",
    label: "Swap right",
    action: (controller: FocusGridController) => swapAdjacentPane(controller, "right"),
    defaultSequence: "Ctrl-B Shift-Right",
  },
  {
    id: "swap-up",
    label: "Swap up",
    action: (controller: FocusGridController) => swapAdjacentPane(controller, "up"),
    defaultSequence: "Ctrl-B Shift-Up",
  },
  {
    id: "swap-down",
    label: "Swap down",
    action: (controller: FocusGridController) => swapAdjacentPane(controller, "down"),
    defaultSequence: "Ctrl-B Shift-Down",
  },
  {
    id: "resize-left",
    label: "Resize left",
    action: (controller: FocusGridController) => resizeActivePane(controller, "left", 48),
    defaultSequence: "Ctrl-B H",
    repeat: true,
  },
  {
    id: "resize-right",
    label: "Resize right",
    action: (controller: FocusGridController) => resizeActivePane(controller, "right", 48),
    defaultSequence: "Ctrl-B L",
    repeat: true,
  },
  {
    id: "resize-up",
    label: "Resize up",
    action: (controller: FocusGridController) => resizeActivePane(controller, "up", 48),
    defaultSequence: "Ctrl-B K",
    repeat: true,
  },
  {
    id: "resize-down",
    label: "Resize down",
    action: (controller: FocusGridController) => resizeActivePane(controller, "down", 48),
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
