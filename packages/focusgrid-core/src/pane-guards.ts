import { buildLayoutIndex } from "./layout/operations";
import { computeLayout } from "./layout/solver";
import type {
  ComputedPane,
  FocusGridControllerState,
  PaneFocusDirection,
  PaneId,
  PaneNode,
  PaneResizeDirection,
  PaneSplitSide,
  PaneSwapDirection,
} from "./state";

export type PaneCommandCapabilities = {
  canResizeX: boolean;
  canResizeY: boolean;
  canRemove: boolean;
  canSplitHorizontal: boolean;
  canSplitVertical: boolean;
  canSwapX: boolean;
  canSwapY: boolean;
  canFocus: boolean;
};

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

export type PaneCommandCapabilityInput = Partial<PaneCommandCapabilities>;
export type PaneCommandGuards = PaneCommandCapabilities;
export type PaneCommandGuardInput = PaneCommandCapabilityInput;

export function getPaneCommandCapabilities(
  pane: PaneNode | null,
): PaneCommandCapabilities {
  if (!pane) {
    return defaultPaneCommandCapabilities;
  }

  return {
    canResizeX: pane.canResizeX ?? true,
    canResizeY: pane.canResizeY ?? true,
    canRemove: pane.canRemove ?? true,
    canSplitHorizontal: pane.canSplitHorizontal ?? true,
    canSplitVertical: pane.canSplitVertical ?? true,
    canSwapX: pane.canSwapX ?? true,
    canSwapY: pane.canSwapY ?? true,
    canFocus: pane.canFocus ?? true,
  };
}

export function findPaneNode(
  state: FocusGridControllerState,
  paneId: PaneId | null,
): PaneNode | null {
  if (!paneId) {
    return null;
  }

  return buildLayoutIndex(state.root).paneNodeByPaneId.get(paneId) ?? null;
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

export function findPaneForFocusCommand(
  state: FocusGridControllerState,
  paneId: PaneId,
  direction: PaneFocusDirection,
  options: { overflow: boolean },
): PaneId | null {
  const layout = computeLayout(state);
  const activePane = layout.panes.find((pane) => pane.paneId === paneId);

  if (!activePane) {
    return null;
  }

  const candidates = sortFocusCandidates(
    layout.panes.filter(
      (pane) =>
        pane.paneId !== paneId && isPaneInDirection(pane, activePane, direction),
    ),
    activePane,
    direction,
  );
  const target = selectFocusablePane(state, candidates, direction);

  if (target || !options.overflow) {
    return target;
  }

  return selectFocusablePane(
    state,
    sortOverflowCandidates(
      layout.panes.filter((pane) => pane.paneId !== paneId),
      direction,
    ),
    direction,
  );
}

function selectFocusablePane(
  state: FocusGridControllerState,
  candidates: ComputedPane[],
  direction: PaneFocusDirection,
): PaneId | null {
  for (const candidate of candidates) {
    if (paneAllowsFocus(findPaneNode(state, candidate.paneId))) {
      return candidate.paneId;
    }
  }

  return null;
}

function sortFocusCandidates(
  candidates: ComputedPane[],
  activePane: ComputedPane,
  direction: PaneFocusDirection,
): ComputedPane[] {
  const activeCenter = getRectCenter(activePane);

  return [...candidates].sort((a, b) => {
    const edgeDelta = compareEnteringEdge(
      getEnteringEdge(a, direction),
      getEnteringEdge(b, direction),
      direction,
    );

    if (edgeDelta !== 0) {
      return edgeDelta;
    }

    const aPerpendicular = Math.abs(
      getPerpendicularCenter(a, direction) -
        getPerpendicularCenter(activePane, direction),
    );
    const bPerpendicular = Math.abs(
      getPerpendicularCenter(b, direction) -
        getPerpendicularCenter(activePane, direction),
    );

    if (aPerpendicular !== bPerpendicular) {
      return aPerpendicular - bPerpendicular;
    }

    return getCenterDistance(a, activeCenter) - getCenterDistance(b, activeCenter);
  });
}

function sortOverflowCandidates(
  candidates: ComputedPane[],
  direction: PaneFocusDirection,
): ComputedPane[] {
  return [...candidates].sort((a, b) => {
    if (direction === "right") return a.rect.x - b.rect.x;
    if (direction === "left") {
      return b.rect.x + b.rect.width - (a.rect.x + a.rect.width);
    }
    if (direction === "down") return a.rect.y - b.rect.y;
    return b.rect.y + b.rect.height - (a.rect.y + a.rect.height);
  });
}

function isPaneInDirection(
  pane: ComputedPane,
  activePane: ComputedPane,
  direction: PaneFocusDirection,
): boolean {
  const epsilon = 0.001;

  if (direction === "right") {
    return pane.rect.x >= activePane.rect.x + activePane.rect.width - epsilon;
  }

  if (direction === "left") {
    return pane.rect.x + pane.rect.width <= activePane.rect.x + epsilon;
  }

  if (direction === "down") {
    return pane.rect.y >= activePane.rect.y + activePane.rect.height - epsilon;
  }

  return pane.rect.y + pane.rect.height <= activePane.rect.y + epsilon;
}

function getEnteringEdge(
  pane: ComputedPane,
  direction: PaneFocusDirection,
): number {
  if (direction === "right") return pane.rect.x;
  if (direction === "left") return pane.rect.x + pane.rect.width;
  if (direction === "down") return pane.rect.y;
  return pane.rect.y + pane.rect.height;
}

function compareEnteringEdge(
  a: number,
  b: number,
  direction: PaneFocusDirection,
): number {
  return direction === "left" || direction === "up" ? b - a : a - b;
}

function getPerpendicularCenter(
  pane: ComputedPane,
  direction: PaneFocusDirection,
): number {
  const center = getRectCenter(pane);
  return isHorizontalDirection(direction) ? center.y : center.x;
}

function getRectCenter(pane: ComputedPane): { x: number; y: number } {
  return {
    x: pane.rect.x + pane.rect.width / 2,
    y: pane.rect.y + pane.rect.height / 2,
  };
}

function getCenterDistance(
  pane: ComputedPane,
  center: { x: number; y: number },
): number {
  const paneCenter = getRectCenter(pane);
  return Math.abs(paneCenter.x - center.x) + Math.abs(paneCenter.y - center.y);
}

function isHorizontalDirection(direction: PaneFocusDirection): boolean {
  return direction === "left" || direction === "right";
}
