import type { FocusGridController } from "../controller";
import type { PaneFocusDirection, PaneResizeDirection, PaneSplitSide, PaneSwapDirection } from "../layout/types";
import { findPaneForFocusCommand, findPaneInDirection } from "../layout/navigation";
import { findPaneNode, getPaneCommandCapabilities, paneAllowsResize, paneAllowsSplit, paneAllowsSwap } from "../pane-guards";

export const DEFAULT_PANE_RESIZE_DELTA_PX = 24;

export function splitActivePane(controller: FocusGridController, side: PaneSplitSide): string | null {
  const state = controller.getState();
  const active = state.activePaneId;
  if (!active || !paneAllowsSplit(findPaneNode(state, active), side)) return null;
  return controller.api.split(active, { side });
}

export function closeActivePane(controller: FocusGridController): boolean {
  const state = controller.getState();
  const active = state.activePaneId;
  if (!active || !getPaneCommandCapabilities(findPaneNode(state, active)).canRemove) return false;
  return controller.api.remove(active);
}

export function focusAdjacentPane(controller: FocusGridController, direction: PaneFocusDirection): boolean {
  const state = controller.getState();
  const active = state.activePaneId;
  if (!active) return false;
  const target = findPaneForFocusCommand(state, active, direction, { overflow: controller.directionalFocusOverflow });
  return target ? controller.api.focus(target) : false;
}

export function swapAdjacentPane(controller: FocusGridController, direction: PaneSwapDirection): boolean {
  const state = controller.getState();
  const active = state.activePaneId;
  if (!active) return false;
  const target = findPaneInDirection(state, active, direction);
  if (!target || !paneAllowsSwap(findPaneNode(state, active), direction) || !paneAllowsSwap(findPaneNode(state, target), direction)) return false;
  return controller.api.swap(active, target);
}

export function resizeActivePane(controller: FocusGridController, direction: PaneResizeDirection, deltaPx = DEFAULT_PANE_RESIZE_DELTA_PX): boolean {
  const state = controller.getState();
  const active = state.activePaneId;
  if (!active || !paneAllowsResize(findPaneNode(state, active), direction)) return false;
  return controller.api.resize(active, { direction, deltaPx });
}
