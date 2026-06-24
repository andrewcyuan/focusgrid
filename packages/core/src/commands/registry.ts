import type {
  PaneFocusDirection,
  PaneResizeDirection,
  PaneSwapDirection,
} from "../layout/types";
import { findPaneInDirection } from "../layout/operations";
import type { Workspace } from "../workspace";
import type { DefaultPaneCommand } from "../keyboard/default-pane-keymap";
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

  run(name: string, workspace: Workspace, args?: unknown): boolean {
    const handler = this.commands.get(name);

    if (!handler) {
      return false;
    }

    handler(
      {
        workspace,
        state: workspace.getState(),
      },
      args,
    );

    return true;
  }
}

export function createDefaultCommandRegistry(): CommandRegistry {
  const commands = new CommandRegistry();

  commands.register("pane.splitRight", ({ workspace, state }) => {
    const active = state.activePaneId;
    if (!active) return;

    workspace.api.split(active, { side: "right" });
  });

  commands.register("pane.splitDown", ({ workspace, state }) => {
    const active = state.activePaneId;
    if (!active) return;

    workspace.api.split(active, { side: "down" });
  });

  commands.register("pane.close", ({ workspace, state }) => {
    const active = state.activePaneId;
    if (!active) return;

    workspace.api.remove(active);
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
  commands.register(name, ({ workspace, state }) => {
    const active = state.activePaneId;
    if (!active) return;

    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: active,
      direction,
    });
  });
}

function registerPaneSwapCommand(
  commands: CommandRegistry,
  name: DefaultPaneCommand,
  direction: PaneSwapDirection,
): void {
  commands.register(name, ({ workspace, state }) => {
    const active = state.activePaneId;
    if (!active) return;

    const target = findPaneInDirection(workspace.getState(), active, direction);

    if (!target) return;

    workspace.api.swap(active, target);
  });
}

function registerPaneResizeCommand(
  commands: CommandRegistry,
  name: DefaultPaneCommand,
  direction: PaneResizeDirection,
): void {
  commands.register<PaneResizeCommandArgs>(name, ({ workspace, state }, args) => {
    const active = state.activePaneId;
    if (!active) return;

    workspace.api.resize(active, {
      direction,
      deltaPx: args?.deltaPx ?? DEFAULT_PANE_RESIZE_DELTA_PX,
    });
  });
}
