import { createId } from "../utils/ids";
import type { PaneFocusDirection, PaneResizeDirection } from "../layout/types";
import type { Workspace } from "../workspace";
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

    workspace.dispatch({
      type: "pane.split",
      paneId: active,
      direction: "horizontal",
      newPaneId: createId("pane"),
    });
  });

  commands.register("pane.splitDown", ({ workspace, state }) => {
    const active = state.activePaneId;
    if (!active) return;

    workspace.dispatch({
      type: "pane.split",
      paneId: active,
      direction: "vertical",
      newPaneId: createId("pane"),
    });
  });

  commands.register("pane.close", ({ workspace, state }) => {
    const active = state.activePaneId;
    if (!active) return;

    workspace.dispatch({
      type: "pane.close",
      paneId: active,
    });
  });

  registerPaneResizeCommand(commands, "pane.resizeLeft", "left");
  registerPaneResizeCommand(commands, "pane.resizeRight", "right");
  registerPaneResizeCommand(commands, "pane.resizeUp", "up");
  registerPaneResizeCommand(commands, "pane.resizeDown", "down");
  registerPaneFocusCommand(commands, "pane.focusLeft", "left");
  registerPaneFocusCommand(commands, "pane.focusRight", "right");
  registerPaneFocusCommand(commands, "pane.focusUp", "up");
  registerPaneFocusCommand(commands, "pane.focusDown", "down");

  return commands;
}

function registerPaneFocusCommand(
  commands: CommandRegistry,
  name: string,
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

function registerPaneResizeCommand(
  commands: CommandRegistry,
  name: string,
  direction: PaneResizeDirection,
): void {
  commands.register<PaneResizeCommandArgs>(name, ({ workspace, state }, args) => {
    const active = state.activePaneId;
    if (!active) return;

    workspace.dispatch({
      type: "pane.resize",
      paneId: active,
      direction,
      deltaPx: args?.deltaPx ?? DEFAULT_PANE_RESIZE_DELTA_PX,
    });
  });
}
