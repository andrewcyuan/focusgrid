import type { FocusGridController } from "../controller";
import type { CardinalDirection } from "../layout/types";
import { findPaneForFocusCommand, findPaneInDirection } from "../layout/navigation";
import { findPaneNode } from "../layout/tree";
import { isHorizontalDirection } from "../layout/spatial";

export const DEFAULT_PANE_RESIZE_DELTA_PX = 24;

export function splitActivePane(controller: FocusGridController, side: CardinalDirection): string | null {
  const state = controller.state;
  const active = state.activePaneId;
  const pane = findPaneNode(state.root, active);
  if (!pane || pane[isHorizontalDirection(side) ? "canSplitHorizontal" : "canSplitVertical"] === false) return null;
  return controller.split(pane.id, { side });
}

export function closeActivePane(controller: FocusGridController): boolean {
  const state = controller.state;
  const active = state.activePaneId;
  if (!active || findPaneNode(state.root, active)?.canRemove === false) return false;
  return controller.remove(active);
}

export function focusAdjacentPane(controller: FocusGridController, direction: CardinalDirection): boolean {
  const state = controller.state;
  const active = state.activePaneId;
  if (!active) return false;
  const target = findPaneForFocusCommand(state, active, direction, controller.directionalFocusOverflow);
  return target ? controller.focus(target) : false;
}

export function swapAdjacentPane(controller: FocusGridController, direction: CardinalDirection): boolean {
  const state = controller.state;
  const active = state.activePaneId;
  if (!active) return false;
  const target = findPaneInDirection(state, active, direction);
  const capability = isHorizontalDirection(direction) ? "canSwapX" : "canSwapY";
  if (!target || findPaneNode(state.root, active)?.[capability] === false || findPaneNode(state.root, target)?.[capability] === false) return false;
  return controller.swap(active, target);
}

export function resizeActivePane(controller: FocusGridController, direction: CardinalDirection, deltaPx = DEFAULT_PANE_RESIZE_DELTA_PX): boolean {
  const state = controller.state;
  const active = state.activePaneId;
  if (!active || findPaneNode(state.root, active)?.[isHorizontalDirection(direction) ? "canResizeX" : "canResizeY"] === false) return false;
  return controller.resize(active, { direction, deltaPx });
}
