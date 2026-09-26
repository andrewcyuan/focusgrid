import { createDefaultPaneKeymap } from "@andrewcyuan/focusgrid/react";
import { findPaneForFocusCommand, type FocusGridController } from "@andrewcyuan/focusgrid/core";

export const paneNavigationShortcuts = ["Ctrl-H panes", "Ctrl-J panes", "Ctrl-K panes", "Ctrl-L panes"] as const;

export function createDemoPaneKeymap(controller: FocusGridController) {
  return [
    ...createDefaultPaneKeymap(controller),
    ...([ ["H", "left"], ["J", "down"], ["K", "up"], ["L", "right"] ] as const).map(([key, direction]) => ({
      sequence: `Ctrl-${key}`,
      action: () => {
        const state = controller.state;
        if (!state.activePaneId) return;
        const target = findPaneForFocusCommand(state, state.activePaneId, direction, controller.directionalFocusOverflow);
        if (target) controller.focus(target);
      },
    })),
  ];
}
