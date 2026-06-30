import type {
  PaneFocusDirection,
  PaneResizeDirection,
  PaneSwapDirection,
} from "../layout/types";
import { findPaneInDirection } from "../layout/operations";
import type { FocusGridController } from "../controller";
import type { DefaultPaneCommand } from "../keyboard/default-pane-keymap";
import {
  findPaneForFocusCommand,
  findPaneNode,
  getPaneCommandGuards,
  paneBlocksResize,
  paneBlocksSplit,
  paneBlocksSwap,
} from "../pane-guards";
import type { CommandHandler } from "./types";

export const DEFAULT_PANE_RESIZE_DELTA_PX = 24;

export type PaneResizeCommandArgs = {
  deltaPx?: number;
};

export class CommandRegistry {
  private commands = new Map<string, CommandHandler>();

  register<TArgs>(name: string, handler: CommandHandler<TArgs>): () => void {
    this.commands.set(name, handler as CommandHandler);

    return () => {
      this.commands.delete(name);
    };
  }

  run(name: string, controller: FocusGridController, args?: unknown): boolean {
    const handler = this.commands.get(name);

    if (!handler) {
      return false;
    }

    handler(
      {
        controller,
        state: controller.getState(),
      },
      args,
    );

    return true;
  }
}

export function createDefaultCommandRegistry(): CommandRegistry {
  const commands = new CommandRegistry();

  commands.register("pane.splitRight", ({ controller, state }) => {
    const active = state.activePaneId;
    if (!active) return;
    if (paneBlocksSplit(findPaneNode(state, active), "right")) return;

    controller.api.split(active, { side: "right" });
  });

  commands.register("pane.splitDown", ({ controller, state }) => {
    const active = state.activePaneId;
    if (!active) return;
    if (paneBlocksSplit(findPaneNode(state, active), "down")) return;

    controller.api.split(active, { side: "down" });
  });

  commands.register("pane.close", ({ controller, state }) => {
    const active = state.activePaneId;
    if (!active) return;
    if (getPaneCommandGuards(findPaneNode(state, active)).noRemove) return;

    controller.api.remove(active);
  });

  registerPaneResizeCommand(commands, "pane.resizeLeft", "left");
  registerPaneResizeCommand(commands, "pane.resizeRight", "right");
  registerPaneResizeCommand(commands, "pane.resizeUp", "up");
  registerPaneResizeCommand(commands, "pane.resizeDown", "down");
  registerPaneFocusCommand(commands, "pane.focusLeft", "left");
  registerPaneFocusCommand(commands, "pane.focusRight", "right");
  registerPaneFocusCommand(commands, "pane.focusUp", "up");
  registerPaneFocusCommand(commands, "pane.focusDown", "down");
  registerPaneSwapCommand(commands, "pane.swapLeft", "left");
  registerPaneSwapCommand(commands, "pane.swapRight", "right");
  registerPaneSwapCommand(commands, "pane.swapUp", "up");
  registerPaneSwapCommand(commands, "pane.swapDown", "down");

  return commands;
}

function registerPaneFocusCommand(
  commands: CommandRegistry,
  name: DefaultPaneCommand,
  direction: PaneFocusDirection,
): void {
  commands.register(name, ({ controller, state }) => {
    const active = state.activePaneId;
    if (!active) return;

    const target = findPaneForFocusCommand(controller.getState(), active, direction, {
      overflow: controller.directionalFocusOverflow,
    });

    if (!target) return;

    controller.api.focus(target);
  });
}

function registerPaneSwapCommand(
  commands: CommandRegistry,
  name: DefaultPaneCommand,
  direction: PaneSwapDirection,
): void {
  commands.register(name, ({ controller, state }) => {
    const active = state.activePaneId;
    if (!active) return;

    const target = findPaneInDirection(controller.getState(), active, direction);

    if (!target) return;
    if (paneBlocksSwap(findPaneNode(state, active), direction)) return;
    if (paneBlocksSwap(findPaneNode(state, target), direction)) return;

    controller.api.swap(active, target);
  });
}

function registerPaneResizeCommand(
  commands: CommandRegistry,
  name: DefaultPaneCommand,
  direction: PaneResizeDirection,
): void {
  commands.register<PaneResizeCommandArgs>(name, ({ controller, state }, args) => {
    const active = state.activePaneId;
    if (!active) return;
    if (paneBlocksResize(findPaneNode(state, active), direction)) return;

    controller.api.resize(active, {
      direction,
      deltaPx: args?.deltaPx ?? DEFAULT_PANE_RESIZE_DELTA_PX,
    });
  });
}
