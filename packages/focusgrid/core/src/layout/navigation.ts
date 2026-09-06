import { findPaneNode, paneAllowsFocus } from "../pane-guards";
import { computeLayout } from "./solver";
import { buildLayoutIndex, collectPaneIds } from "./tree";
import {
  compareEnteringEdge,
  getCenterDistance,
  getEnteringEdge,
  getPerpendicularCenter,
  getRectCenter,
  isRectInDirection,
} from "./spatial";
import type {
  ComputedPane,
  FocusGridControllerState,
  PaneFocusDirection,
  PaneId,
  LayoutNode,
  NodeId,
  SplitNode,
} from "./types";

export function findPaneInDirection(
  state: FocusGridControllerState,
  paneId: PaneId,
  direction: PaneFocusDirection,
): PaneId | null {
  const index = buildLayoutIndex(state.root);
  const paneNode = index.paneNodeByPaneId.get(paneId);
  if (!paneNode) return null;

  const layout = computeLayout(state);
  const activePane = layout.panes.find((pane) => pane.paneId === paneId);
  if (!activePane) return null;

  let currentId = paneNode.id;
  let parent = index.parentByNodeId.get(currentId) ?? null;
  while (parent) {
    const sibling = findDirectionalSibling(parent, currentId, direction);
    if (sibling) {
      return findTargetPaneInSubtree(sibling, layout.panes, activePane, direction);
    }
    currentId = parent.id;
    parent = index.parentByNodeId.get(currentId) ?? null;
  }
  return null;
}

export function findPaneForFocusCommand(
  state: FocusGridControllerState,
  paneId: PaneId,
  direction: PaneFocusDirection,
  options: { overflow: boolean },
): PaneId | null {
  const layout = computeLayout(state);
  const activePane = layout.panes.find((pane) => pane.paneId === paneId);
  if (!activePane) return null;

  const candidates = sortFocusCandidates(
    layout.panes.filter(
      (pane) =>
        pane.paneId !== paneId &&
        isRectInDirection(pane.rect, activePane.rect, direction),
    ),
    activePane,
    direction,
  );
  const target = selectFocusablePane(state, candidates);
  if (target || !options.overflow) return target;

  return selectFocusablePane(
    state,
    sortOverflowCandidates(
      layout.panes.filter((pane) => pane.paneId !== paneId),
      direction,
    ),
  );
}

function selectFocusablePane(
  state: FocusGridControllerState,
  candidates: ComputedPane[],
): PaneId | null {
  return candidates.find((candidate) =>
    paneAllowsFocus(findPaneNode(state, candidate.paneId)),
  )?.paneId ?? null;
}

function sortFocusCandidates(
  candidates: ComputedPane[],
  activePane: ComputedPane,
  direction: PaneFocusDirection,
): ComputedPane[] {
  const activeCenter = getRectCenter(activePane.rect);
  return [...candidates].sort((first, second) => {
    const edgeDelta = compareEnteringEdge(
      getEnteringEdge(first.rect, direction),
      getEnteringEdge(second.rect, direction),
      direction,
    );
    if (edgeDelta !== 0) return edgeDelta;

    const firstPerpendicular = Math.abs(
      getPerpendicularCenter(first.rect, direction) -
        getPerpendicularCenter(activePane.rect, direction),
    );
    const secondPerpendicular = Math.abs(
      getPerpendicularCenter(second.rect, direction) -
        getPerpendicularCenter(activePane.rect, direction),
    );
    if (firstPerpendicular !== secondPerpendicular) {
      return firstPerpendicular - secondPerpendicular;
    }

    return (
      getCenterDistance(first.rect, activeCenter) -
      getCenterDistance(second.rect, activeCenter)
    );
  });
}

function sortOverflowCandidates(
  candidates: ComputedPane[],
  direction: PaneFocusDirection,
): ComputedPane[] {
  return [...candidates].sort((first, second) => {
    if (direction === "right") return first.rect.x - second.rect.x;
    if (direction === "left") {
      return second.rect.x + second.rect.width - (first.rect.x + first.rect.width);
    }
    if (direction === "down") return first.rect.y - second.rect.y;
    return second.rect.y + second.rect.height - (first.rect.y + first.rect.height);
  });
}

function findDirectionalSibling(
  parent: SplitNode,
  childId: NodeId,
  direction: PaneFocusDirection,
): LayoutNode | null {
  const childIndex = parent.children.findIndex((child) => child.id === childId);
  if (childIndex === -1) return null;

  const horizontal = direction === "left" || direction === "right";
  if (horizontal && parent.direction === "horizontal") {
    if (direction === "right") return parent.children[childIndex + 1] ?? null;
    return parent.children[childIndex - 1] ?? null;
  }
  if (!horizontal && parent.direction === "vertical") {
    if (direction === "down") return parent.children[childIndex + 1] ?? null;
    return parent.children[childIndex - 1] ?? null;
  }
  return null;
}

function findTargetPaneInSubtree(
  subtree: LayoutNode,
  panes: ComputedPane[],
  activePane: ComputedPane,
  direction: PaneFocusDirection,
): PaneId | null {
  const subtreePaneIds = new Set(collectPaneIds(subtree));
  const candidates = panes.filter((pane) => subtreePaneIds.has(pane.paneId));
  if (candidates.length === 0) return null;

  const activeCenter = getRectCenter(activePane.rect);
  return candidates
    .map((pane) => ({
      pane,
      edge: getEnteringEdge(pane.rect, direction),
      perpendicularDistance: Math.abs(
        getPerpendicularCenter(pane.rect, direction) -
          getPerpendicularCenter(activePane.rect, direction),
      ),
      focusMemoryRank: getFocusMemoryRank(subtree, pane.paneId),
      centerDistance: getCenterDistance(pane.rect, activeCenter),
    }))
    .sort((first, second) =>
      compareEnteringEdge(first.edge, second.edge, direction) ||
      first.focusMemoryRank - second.focusMemoryRank ||
      first.perpendicularDistance - second.perpendicularDistance ||
      first.centerDistance - second.centerDistance,
    )[0]!.pane.paneId;
}

function getFocusMemoryRank(subtree: LayoutNode, paneId: PaneId): number {
  if (subtree.kind === "pane") return Number.POSITIVE_INFINITY;

  const rememberedChild = subtree.children.find(
    (child) => child.id === subtree.lastFocusedChildId,
  );
  if (!rememberedChild || !collectPaneIds(rememberedChild).includes(paneId)) {
    return Number.POSITIVE_INFINITY;
  }
  if (rememberedChild.kind === "pane") return 0;

  const nestedRank = getFocusMemoryRank(rememberedChild, paneId);
  return Number.isFinite(nestedRank) ? nestedRank : 1;
}
