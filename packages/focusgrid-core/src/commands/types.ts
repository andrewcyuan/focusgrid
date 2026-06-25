import type { Workspace } from "../workspace";
import type { WorkspaceState } from "../state";

export type CommandContext = {
  workspace: Workspace;
  state: WorkspaceState;
};

export type CommandHandler<TArgs = unknown> = (
  ctx: CommandContext,
  args: TArgs,
) => void;
