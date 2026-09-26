import type { FocusGridController } from "@andrewcyuan/focusgrid/core";
import type { ShortcutBinding } from "@andrewcyuan/shortcut-engine";

// Pane bindings from ~/.config/.tmux.conf. Session and terminal commands do not apply here.
export function createPlaygroundKeymap(controller: FocusGridController): ShortcutBinding[] {
  return [
    { sequence: "ctrl-s |", action: () => controller.splitActive("right") },
    { sequence: "ctrl-s -", action: () => controller.splitActive("down") },
    { sequence: "ctrl-s x", action: () => controller.removeActive() },
    ...([ ["h", "left"], ["j", "down"], ["k", "up"], ["l", "right"] ] as const).flatMap(([key, direction]) => [
      { sequence: `ctrl-${key}`, action: () => controller.focusAdjacent(direction) },
      // Terminal cell sizes do not map to pixels; keep the demo's 48px resize step.
      { sequence: `ctrl-shift-${key}`, action: () => controller.resizeActive(direction, 48) },
      // Keep the demo's directional swap commands under the configured prefix.
      { sequence: `ctrl-s shift-${direction}`, action: () => controller.swapAdjacent(direction) },
    ]),
  ];
}
