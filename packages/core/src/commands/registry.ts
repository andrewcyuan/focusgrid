import { createId } from "../utils/ids";
import type { Workspace } from "../workspace";
import type { CommandHandler } from "./types";

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

  return commands;
}
