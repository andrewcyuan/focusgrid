import { createDefaultPaneKeymap } from "@focusgrid/focusgrid/core";

export const paneNavigationShortcuts = [
  "Ctrl-H panes",
  "Ctrl-J panes",
  "Ctrl-K panes",
  "Ctrl-L panes",
] as const;

export function createDemoPaneKeymap() {
  return createDefaultPaneKeymap({
    overrides: {
      "focus-left": "Ctrl-H",
      "focus-down": "Ctrl-J",
      "focus-up": "Ctrl-K",
      "focus-right": "Ctrl-L",
    },
  }).keymap;
}
