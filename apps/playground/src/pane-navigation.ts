import { createDefaultPaneKeymap, focusAdjacentPane, type FocusGridController } from "@andrewcyuan/focusgrid/core";
import { parseKeySequence } from "@andrewcyuan/shortcut-engine";

export const paneNavigationShortcuts = ["Ctrl-H panes", "Ctrl-J panes", "Ctrl-K panes", "Ctrl-L panes"] as const;

export function createDemoPaneKeymap(controller: FocusGridController) {
  return [
    ...createDefaultPaneKeymap(controller),
    ...([ ["H", "left"], ["J", "down"], ["K", "up"], ["L", "right"] ] as const).map(([key, direction]) => ({
      sequence: parseKeySequence(`Ctrl-${key}`),
      action: () => { focusAdjacentPane(controller, direction); },
    })),
  ];
}
