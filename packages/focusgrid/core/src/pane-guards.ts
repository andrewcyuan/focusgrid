import { findPaneNode as findPaneNodeInTree } from "./layout/tree";
import { paneCommandCapabilityKeys } from "./layout/types";
import { isHorizontalDirection } from "./layout/spatial";
import type {
  FocusGridControllerState,
  PaneId,
  PaneNode,
  PaneResizeDirection,
  PaneSplitSide,
  PaneSwapDirection,
  PaneCommandCapabilities,
  PaneCommandCapabilityInput,
} from "./layout/types";

export const defaultPaneCommandCapabilities: PaneCommandCapabilities = {
  canResizeX: true,
  canResizeY: true,
  canRemove: true,
  canSplitHorizontal: true,
  canSplitVertical: true,
  canSwapX: true,
  canSwapY: true,
  canFocus: true,
};

export type { PaneCommandCapabilities, PaneCommandCapabilityInput };

export function getPaneCommandCapabilities(
  pane: PaneNode | null,
): PaneCommandCapabilities {
  if (!pane) {
    return defaultPaneCommandCapabilities;
  }

  return Object.fromEntries(
    paneCommandCapabilityKeys.map((key) => [key, pane[key] ?? true]),
  ) as PaneCommandCapabilities;
}

export function applyPaneCapabilityDefaults(
  pane: PaneNode,
  defaults: PaneCommandCapabilityInput,
): PaneNode {
  let next = pane;
  for (const key of paneCommandCapabilityKeys) {
    if (pane[key] === undefined && defaults[key] !== undefined) {
      if (next === pane) next = { ...pane };
      next[key] = defaults[key];
    }
  }
  return next;
}

export function patchPaneCapabilities(
  pane: PaneNode,
  patch: PaneCommandCapabilityInput,
): PaneNode {
  let next = pane;
  for (const key of paneCommandCapabilityKeys) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && pane[key] !== patch[key]) {
      if (next === pane) next = { ...pane };
      next[key] = patch[key];
    }
  }
  return next;
}

export function findPaneNode(
  state: FocusGridControllerState,
  paneId: PaneId | null,
): PaneNode | null {
  if (!paneId) {
    return null;
  }

  return findPaneNodeInTree(state.root, paneId);
}

export function paneAllowsResize(
  pane: PaneNode | null,
  direction: PaneResizeDirection,
): boolean {
  const capabilities = getPaneCommandCapabilities(pane);
  return isHorizontalDirection(direction)
    ? capabilities.canResizeX
    : capabilities.canResizeY;
}

export function paneAllowsSplit(
  pane: PaneNode | null,
  side: PaneSplitSide,
): boolean {
  const capabilities = getPaneCommandCapabilities(pane);
  return isHorizontalDirection(side)
    ? capabilities.canSplitHorizontal
    : capabilities.canSplitVertical;
}

export function paneAllowsSwap(
  pane: PaneNode | null,
  direction: PaneSwapDirection,
): boolean {
  const capabilities = getPaneCommandCapabilities(pane);
  return isHorizontalDirection(direction)
    ? capabilities.canSwapX
    : capabilities.canSwapY;
}

export function paneAllowsFocus(pane: PaneNode | null): boolean {
  return getPaneCommandCapabilities(pane).canFocus;
}
