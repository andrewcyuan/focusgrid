import { collectPaneIds, findPaneNode, findPanePath, type PanePathStep } from "./tree";
import {
  PaneCommandCapability,
  type CardinalDirection,
  type ComputedLayout,
  type ComputedPane,
  type LayoutNode,
  type PaneId,
  type Rect,
} from "./types";

export function isHorizontalDirection(direction: CardinalDirection): boolean {
  return direction === "left" || direction === "right";
}

export function isForwardDirection(direction: CardinalDirection): boolean {
  return direction === "right" || direction === "down";
}

export function nearestSplitsOnAxis(path: PanePathStep[], direction: CardinalDirection): PanePathStep[] {
  const horizontal = isHorizontalDirection(direction);
  return path.filter(({ split }) => (split.orientation === "horizontal") === horizontal).toReversed();
}

export function findPaneInDirection(
  root: LayoutNode,
  layout: ComputedLayout,
  paneId: PaneId,
  direction: CardinalDirection,
): PaneId | null {
  const activePane = layout.panes.find((pane) => pane.paneId === paneId);
  const path = findPanePath(root, paneId);
  if (!activePane || !path) return null;

  for (const { split, childIndex } of nearestSplitsOnAxis(path, direction)) {
    const sibling = split.children[childIndex + (isForwardDirection(direction) ? 1 : -1)];
    if (!sibling) continue;
    const siblingPaneIds = new Set(collectPaneIds(sibling));
    return findClosestPane(
      layout.panes.filter((pane) => siblingPaneIds.has(pane.paneId)),
      activePane,
      direction,
      (candidateId) => getFocusMemoryRank(sibling, candidateId),
    );
  }
  return null;
}

export function findPaneForFocusCommand(
  root: LayoutNode,
  layout: ComputedLayout,
  paneId: PaneId,
  direction: CardinalDirection,
  overflow: boolean,
): PaneId | null {
  const activePane = layout.panes.find((pane) => pane.paneId === paneId);
  if (!activePane) return null;

  const candidates = layout.panes.filter(
    (pane) => pane.paneId !== paneId && findPaneNode(root, pane.paneId)?.[PaneCommandCapability.Focus] !== false,
  );
  const target = findClosestPane(
    candidates.filter((pane) => isRectInDirection(pane.rect, activePane.rect, direction)),
    activePane,
    direction,
    () => 0,
  );
  if (target || !overflow) return target;
  const wrapped = candidates.toSorted(
    (first, second) => enteringEdgeOrder(first.rect, direction) - enteringEdgeOrder(second.rect, direction),
  );
  return wrapped[0]?.paneId ?? null;
}

function findClosestPane(
  candidates: ComputedPane[],
  activePane: ComputedPane,
  direction: CardinalDirection,
  focusMemoryRank: (paneId: PaneId) => number,
): PaneId | null {
  const activeCenter = rectCenter(activePane.rect);
  const ranked = candidates.map((pane) => {
    const center = rectCenter(pane.rect);
    const dx = Math.abs(center.x - activeCenter.x);
    const dy = Math.abs(center.y - activeCenter.y);
    return {
      paneId: pane.paneId,
      edge: enteringEdgeOrder(pane.rect, direction),
      memory: focusMemoryRank(pane.paneId),
      perpendicular: isHorizontalDirection(direction) ? dy : dx,
      centerDistance: dx + dy,
    };
  });
  ranked.sort(
    (first, second) =>
      first.edge - second.edge ||
      first.memory - second.memory ||
      first.perpendicular - second.perpendicular ||
      first.centerDistance - second.centerDistance,
  );
  return ranked[0]?.paneId ?? null;
}

function getFocusMemoryRank(subtree: LayoutNode, paneId: PaneId): number {
  if (subtree.kind === "pane") return Number.POSITIVE_INFINITY;

  const rememberedChild = subtree.children.find((child) => child.id === subtree.lastFocusedChildId);
  if (!rememberedChild || !collectPaneIds(rememberedChild).includes(paneId)) {
    return Number.POSITIVE_INFINITY;
  }
  if (rememberedChild.kind === "pane") return 0;

  const nestedRank = getFocusMemoryRank(rememberedChild, paneId);
  return Number.isFinite(nestedRank) ? nestedRank : 1;
}

function isRectInDirection(rect: Rect, activeRect: Rect, direction: CardinalDirection): boolean {
  const epsilon = 0.001;
  if (direction === "right") return rect.x >= activeRect.x + activeRect.width - epsilon;
  if (direction === "left") return rect.x + rect.width <= activeRect.x + epsilon;
  if (direction === "down") return rect.y >= activeRect.y + activeRect.height - epsilon;
  return rect.y + rect.height <= activeRect.y + epsilon;
}

function enteringEdgeOrder(rect: Rect, direction: CardinalDirection): number {
  if (direction === "right") return rect.x;
  if (direction === "left") return -(rect.x + rect.width);
  if (direction === "down") return rect.y;
  return -(rect.y + rect.height);
}

function rectCenter(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
