import type { FocusGridController } from "../controller";
import type { FocusGridControllerState } from "../layout/types";

export type CommandContext = {
  controller: FocusGridController;
  state: FocusGridControllerState;
};

export type CommandHandler<TArgs = unknown> = (
  ctx: CommandContext,
  args: TArgs,
) => void;
