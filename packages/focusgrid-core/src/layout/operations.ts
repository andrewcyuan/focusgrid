import { createId } from "../utils/ids";
import { HANDLE_SIZE } from "./constants";
import { computeLayout } from "./solver";
import type {
  ComputedPane,
  Direction,
  LayoutIndex,
  LayoutNode,
  NodeId,
  PaneFocusDirection,
  PaneId,
  PaneResizeDirection,
  PaneSplitSide,
  PaneSwapDirection,
  PaneNode,
  Rect,
  SplitNode,
  FocusGridControllerState,
} from "./types";
import type { PaneCommandGuardInput } from "../pane-guards";

export function buildLayoutIndex(root: LayoutNode): LayoutIndex {
  const index: LayoutIndex = {
    nodeById: new Map(),
    paneNodeByPaneId: new Map(),
    parentByNodeId: new Map(),
  };

  visit(root, null);
  return index;

  function visit(node: LayoutNode, parent: SplitNode | null): void {
    index.nodeById.set(node.id, node);
    index.parentByNodeId.set(node.id, parent);

    if (node.kind === "pane") {
      index.paneNodeByPaneId.set(node.paneId, node);
      return;
    }

    for (const child of node.children) {
      visit(child, node);
    }
  }
}

export function findSplitNode(root: LayoutNode, splitId: NodeId): SplitNode | null {
  const node = buildLayoutIndex(root).nodeById.get(splitId);
  return node?.kind === "split" ? node : null;
}

export function focusPane(state: FocusGridControllerState, paneId: PaneId): FocusGridControllerState {
  if (!buildLayoutIndex(state.root).paneNodeByPaneId.has(paneId)) {
    return state;
  }

  const nextRoot = markFocusedPanePath(state.root, paneId);

  if (state.activePaneId === paneId && nextRoot === state.root) {
    return state;
  }

  return {
    ...state,
    root: nextRoot,
    activePaneId: paneId,
  };
}

export function focusPaneInDirection(
  state: FocusGridControllerState,
  paneId: PaneId,
  direction: PaneFocusDirection,
): FocusGridControllerState {
  const targetPaneId = findPaneInDirection(state, paneId, direction);

  if (!targetPaneId) {
    return state;
  }

  return focusPane(
    {
      ...state,
      root: markFocusedPanePath(state.root, paneId),
    },
    targetPaneId,
  );
}

export function findPaneInDirection(
  state: FocusGridControllerState,
  paneId: PaneId,
  direction: PaneFocusDirection,
): PaneId | null {
  const index = buildLayoutIndex(state.root);
  const paneNode = index.paneNodeByPaneId.get(paneId);

  if (!paneNode) {
    return null;
  }

  const layout = computeLayout(state);
  const activePane = layout.panes.find((pane) => pane.paneId === paneId);

  if (!activePane) {
    return null;
  }

  let currentId = paneNode.id;
  let parent = index.parentByNodeId.get(currentId) ?? null;

  while (parent) {
    const sibling = findDirectionalSibling(parent, currentId, direction);

    if (sibling) {
      const targetPaneId = findTargetPaneInSubtree(
        sibling,
        layout.panes,
        activePane,
        direction,
      );

      if (!targetPaneId) {
        return null;
      }

      return targetPaneId;
    }

    currentId = parent.id;
    parent = index.parentByNodeId.get(currentId) ?? null;
  }

  return null;
}

export type SplitPaneOptions = PaneCommandGuardInput & {
  side: PaneSplitSide;
  newPaneId?: PaneId;
  preserveActivePane?: boolean;
};

export type WrapRootInSplitOptions = PaneCommandGuardInput & {
  side: PaneSplitSide;
  newPaneId?: PaneId;
  minWidth?: number;
  minHeight?: number;
  data?: unknown;
  preserveActivePane?: boolean;
};

export type ResizePaneOptions = {
  direction: PaneResizeDirection;
  deltaPx: number;
};

export type UpdatePaneCommandGuardsOptions = PaneCommandGuardInput;

export function splitPane(
  state: FocusGridControllerState,
  paneId: PaneId,
  options: SplitPaneOptions,
): FocusGridControllerState;
export function splitPane(
  state: FocusGridControllerState,
  paneId: PaneId,
  direction: Direction,
  newPaneId: PaneId,
): FocusGridControllerState;
export function splitPane(
  state: FocusGridControllerState,
  paneId: PaneId,
  optionsOrDirection: SplitPaneOptions | Direction,
  legacyNewPaneId?: PaneId,
): FocusGridControllerState {
  const options =
    typeof optionsOrDirection === "string"
      ? directionToSplitOptions(optionsOrDirection, legacyNewPaneId)
      : optionsOrDirection;
  const newPaneId = options.newPaneId ?? createId("pane");
  const direction = splitSideToDirection(options.side);
  const index = buildLayoutIndex(state.root);

  if (index.paneNodeByPaneId.has(newPaneId)) {
    return state;
  }

  let didSplit = false;

  const nextRoot = mapLayout(state.root, (node) => {
    if (node.kind !== "pane" || node.paneId !== paneId) {
      return node;
    }

    didSplit = true;

    const originalPane: PaneNode = {
      ...node,
    };

    const newPane: PaneNode = {
      kind: "pane",
      id: createId("node"),
      paneId: newPaneId,
      minWidth: node.minWidth,
      minHeight: node.minHeight,
      noResizeX: options.noResizeX,
      noResizeY: options.noResizeY,
      noRemove: options.noRemove,
      noSplitHorizontal: options.noSplitHorizontal,
      noSplitVertical: options.noSplitVertical,
      noSwapX: options.noSwapX,
      noSwapY: options.noSwapY,
      noFocus: options.noFocus,
    };

    return {
      kind: "split",
      id: createId("split"),
      direction,
      children:
        options.side === "left" || options.side === "up"
          ? [newPane, originalPane]
          : [originalPane, newPane],
      sizes: [0.5, 0.5],
    };
  });

  if (!didSplit) {
    return state;
  }

  const activePaneId = options.preserveActivePane ? state.activePaneId : newPaneId;

  return {
    ...state,
    root: activePaneId ? markFocusedPanePath(nextRoot, activePaneId) : nextRoot,
    activePaneId,
  };
}

export function wrapRootInSplit(
  state: FocusGridControllerState,
  options: WrapRootInSplitOptions,
): FocusGridControllerState {
  const newPaneId = options.newPaneId ?? createId("pane");
  const index = buildLayoutIndex(state.root);

  if (index.paneNodeByPaneId.has(newPaneId)) {
    return state;
  }

  const newPane: PaneNode = {
    kind: "pane",
    id: createId("node"),
    paneId: newPaneId,
    minWidth: options.minWidth,
    minHeight: options.minHeight,
    noResizeX: options.noResizeX,
    noResizeY: options.noResizeY,
    noRemove: options.noRemove,
    noSplitHorizontal: options.noSplitHorizontal,
    noSplitVertical: options.noSplitVertical,
    noSwapX: options.noSwapX,
    noSwapY: options.noSwapY,
    noFocus: options.noFocus,
    data: options.data,
  };
  const direction = splitSideToDirection(options.side);
  const nextRoot: SplitNode = {
    kind: "split",
    id: createId("split"),
    direction,
    children:
      options.side === "left" || options.side === "up"
        ? [newPane, state.root]
        : [state.root, newPane],
    sizes: [0.5, 0.5],
  };
  const activePaneId = options.preserveActivePane ? state.activePaneId : newPaneId;

  return {
    ...state,
    root: activePaneId ? markFocusedPanePath(nextRoot, activePaneId) : nextRoot,
    activePaneId,
  };
}

export function removePane(state: FocusGridControllerState, paneId: PaneId): FocusGridControllerState {
  const panes = collectPaneIds(state.root);

  if (!panes.includes(paneId) || panes.length <= 1) {
    return state;
  }

  const nextRoot = removePaneNode(state.root, paneId);

  if (!nextRoot) {
    return state;
  }

  const nextPanes = collectPaneIds(nextRoot);
  const activePaneId =
    state.activePaneId === paneId ? nextPanes[0] ?? null : state.activePaneId;

  return {
    ...state,
    root: activePaneId ? markFocusedPanePath(nextRoot, activePaneId) : nextRoot,
    activePaneId,
  };
}

export function updatePaneCommandGuards(
  state: FocusGridControllerState,
  paneId: PaneId,
  options: UpdatePaneCommandGuardsOptions,
): FocusGridControllerState {
  let didUpdate = false;

  const nextRoot = mapLayout(state.root, (node) => {
    if (node.kind !== "pane" || node.paneId !== paneId) {
      return node;
    }

    const nextPane = {
      ...node,
      ...options,
    };

    if (
      nextPane.noResizeX === node.noResizeX &&
      nextPane.noResizeY === node.noResizeY &&
      nextPane.noRemove === node.noRemove &&
      nextPane.noSplitHorizontal === node.noSplitHorizontal &&
      nextPane.noSplitVertical === node.noSplitVertical &&
      nextPane.noSwapX === node.noSwapX &&
      nextPane.noSwapY === node.noSwapY &&
      nextPane.noFocus === node.noFocus
    ) {
      return node;
    }

    didUpdate = true;
    return nextPane;
  });

  return didUpdate
    ? {
        ...state,
        root: nextRoot,
      }
    : state;
}

export function closePane(state: FocusGridControllerState, paneId: PaneId): FocusGridControllerState {
  return removePane(state, paneId);
}

export function swapPanes(
  state: FocusGridControllerState,
  firstPaneId: PaneId,
  secondPaneId: PaneId,
): FocusGridControllerState {
  if (firstPaneId === secondPaneId) {
    return state;
  }

  const index = buildLayoutIndex(state.root);
  const firstPane = index.paneNodeByPaneId.get(firstPaneId);
  const secondPane = index.paneNodeByPaneId.get(secondPaneId);

  if (!firstPane || !secondPane) {
    return state;
  }

  const nextRoot = mapLayout(state.root, (node) => {
    if (node.kind !== "pane") {
      return node;
    }

    if (node.id === firstPane.id) {
      return {
        ...secondPane,
        id: node.id,
      };
    }

    if (node.id === secondPane.id) {
      return {
        ...firstPane,
        id: node.id,
      };
    }

    return node;
  });

  return {
    ...state,
    root: state.activePaneId
      ? markFocusedPanePath(nextRoot, state.activePaneId)
      : nextRoot,
  };
}

export function swapPaneInDirection(
  state: FocusGridControllerState,
  paneId: PaneId,
  direction: PaneSwapDirection,
): FocusGridControllerState {
  const targetPaneId = findPaneInDirection(state, paneId, direction);

  if (!targetPaneId) {
    return state;
  }

  return swapPanes(state, paneId, targetPaneId);
}

export function resizeHandle(
  state: FocusGridControllerState,
  splitId: NodeId,
  index: number,
  deltaPx: number,
  snapshotSizes?: number[],
): FocusGridControllerState {
  let didResize = false;

  const nextRoot = mapLayout(state.root, (node) => {
    if (node.kind !== "split" || node.id !== splitId) {
      return node;
    }

    const totalPx = getSplitAxisSize(state, splitId);

    if (totalPx <= 0 || index < 0 || index >= node.children.length - 1) {
      return node;
    }

    const baseSizes = normalizeSizes(snapshotSizes ?? node.sizes, node.children.length);
    const deltaRatio = deltaPx / totalPx;
    const nextSizes = [...baseSizes];
    nextSizes[index] += deltaRatio;
    nextSizes[index + 1] -= deltaRatio;

    const minSizes = node.children.map((child) =>
      getMinRatio(child, node.direction, totalPx),
    );
    const currentSizes = normalizeSizes(node.sizes, node.children.length);
    const clamped = clampAdjacentPair(nextSizes, minSizes, index);
    const fitted = fitNodeToAxisSize(
      {
        ...node,
        sizes: clamped,
      },
      node.direction,
      totalPx,
    );

    if (fitted.kind !== "split" || sizesEqual(fitted.sizes, currentSizes)) {
      return node;
    }

    didResize = true;
    return fitted;
  });

  if (!didResize) {
    return state;
  }

  return {
    ...state,
    root: nextRoot,
  };
}

export function resizePane(
  state: FocusGridControllerState,
  paneId: PaneId,
  options: ResizePaneOptions,
): FocusGridControllerState;
export function resizePane(
  state: FocusGridControllerState,
  paneId: PaneId,
  direction: PaneResizeDirection,
  deltaPx: number,
): FocusGridControllerState;
export function resizePane(
  state: FocusGridControllerState,
  paneId: PaneId,
  optionsOrDirection: ResizePaneOptions | PaneResizeDirection,
  legacyDeltaPx?: number,
): FocusGridControllerState {
  const options =
    typeof optionsOrDirection === "string"
      ? { direction: optionsOrDirection, deltaPx: legacyDeltaPx ?? 0 }
      : optionsOrDirection;
  const index = buildLayoutIndex(state.root);
  const paneNode = index.paneNodeByPaneId.get(paneId);

  if (!paneNode) {
    return state;
  }

  const boundary = resolvePaneResizeBoundary(index, paneNode.id, options.direction);

  if (!boundary) {
    return state;
  }

  return resizeHandle(
    state,
    boundary.splitId,
    boundary.index,
    boundary.deltaPxSign * options.deltaPx,
  );
}

function directionToSplitOptions(
  direction: Direction,
  newPaneId?: PaneId,
): SplitPaneOptions {
  return {
    side: direction === "horizontal" ? "right" : "down",
    newPaneId,
  };
}

function splitSideToDirection(side: PaneSplitSide): Direction {
  return side === "left" || side === "right" ? "horizontal" : "vertical";
}

export function collectPaneIds(root: LayoutNode): PaneId[] {
  const out: PaneId[] = [];
  visit(root);
  return out;

  function visit(node: LayoutNode): void {
    if (node.kind === "pane") {
      out.push(node.paneId);
      return;
    }

    for (const child of node.children) {
      visit(child);
    }
  }
}

function resolvePaneResizeBoundary(
  index: LayoutIndex,
  nodeId: NodeId,
  direction: PaneResizeDirection,
): { splitId: NodeId; index: number; deltaPxSign: 1 | -1 } | null {
  let currentId = nodeId;
  let parent = index.parentByNodeId.get(currentId) ?? null;

  while (parent) {
    const childIndex = parent.children.findIndex((child) => child.id === currentId);

    if (childIndex === -1) {
      return null;
    }

    if (isHorizontalResize(direction) === (parent.direction === "horizontal")) {
      const boundaryIndex =
        childIndex > 0
          ? childIndex - 1
          : childIndex < parent.children.length - 1
            ? childIndex
            : null;

      if (boundaryIndex !== null) {
        return {
          splitId: parent.id,
          index: boundaryIndex,
          deltaPxSign: isPositiveBoundaryDirection(direction) ? 1 : -1,
        };
      }
    }

    currentId = parent.id;
    parent = index.parentByNodeId.get(currentId) ?? null;
  }

  return null;
}

function findDirectionalSibling(
  parent: SplitNode,
  childId: NodeId,
  direction: PaneFocusDirection,
): LayoutNode | null {
  const childIndex = parent.children.findIndex((child) => child.id === childId);

  if (childIndex === -1) {
    return null;
  }

  if (isHorizontalDirection(direction) && parent.direction === "horizontal") {
    if (direction === "right" && childIndex < parent.children.length - 1) {
      return parent.children[childIndex + 1]!;
    }

    if (direction === "left" && childIndex > 0) {
      return parent.children[childIndex - 1]!;
    }
  }

  if (!isHorizontalDirection(direction) && parent.direction === "vertical") {
    if (direction === "down" && childIndex < parent.children.length - 1) {
      return parent.children[childIndex + 1]!;
    }

    if (direction === "up" && childIndex > 0) {
      return parent.children[childIndex - 1]!;
    }
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

  if (candidates.length === 0) {
    return null;
  }

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
      centerDistance:
        Math.abs(getRectCenter(pane.rect).x - activeCenter.x) +
        Math.abs(getRectCenter(pane.rect).y - activeCenter.y),
    }))
    .sort((a, b) => {
      const edgeDelta = compareEnteringEdge(a.edge, b.edge, direction);

      if (edgeDelta !== 0) {
        return edgeDelta;
      }

      if (a.focusMemoryRank !== b.focusMemoryRank) {
        return a.focusMemoryRank - b.focusMemoryRank;
      }

      if (a.perpendicularDistance !== b.perpendicularDistance) {
        return a.perpendicularDistance - b.perpendicularDistance;
      }

      return a.centerDistance - b.centerDistance;
    })[0]!.pane.paneId;
}

function getFocusMemoryRank(subtree: LayoutNode, paneId: PaneId): number {
  if (subtree.kind === "pane") {
    return Number.POSITIVE_INFINITY;
  }

  const rememberedChild = subtree.children.find(
    (child) => child.id === subtree.lastFocusedChildId,
  );

  if (!rememberedChild || !collectPaneIds(rememberedChild).includes(paneId)) {
    return Number.POSITIVE_INFINITY;
  }

  if (rememberedChild.kind === "pane") {
    return 0;
  }

  const nestedRank = getFocusMemoryRank(rememberedChild, paneId);

  return Number.isFinite(nestedRank) ? nestedRank : 1;
}

function getEnteringEdge(rect: Rect, direction: PaneFocusDirection): number {
  if (direction === "right") {
    return rect.x;
  }

  if (direction === "left") {
    return rect.x + rect.width;
  }

  if (direction === "down") {
    return rect.y;
  }

  return rect.y + rect.height;
}

function compareEnteringEdge(
  a: number,
  b: number,
  direction: PaneFocusDirection,
): number {
  return direction === "left" || direction === "up" ? b - a : a - b;
}

function getPerpendicularCenter(
  rect: Rect,
  direction: PaneFocusDirection,
): number {
  const center = getRectCenter(rect);
  return isHorizontalDirection(direction) ? center.y : center.x;
}

function getRectCenter(rect: Rect): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function isHorizontalDirection(direction: PaneFocusDirection): boolean {
  return direction === "left" || direction === "right";
}

function isHorizontalResize(direction: PaneResizeDirection): boolean {
  return direction === "left" || direction === "right";
}

function isPositiveBoundaryDirection(direction: PaneResizeDirection): boolean {
  return direction === "right" || direction === "down";
}

function getSplitAxisSize(state: FocusGridControllerState, splitId: NodeId): number {
  const split = findSplitNode(state.root, splitId);
  const rect = findSplitRect(
    state.root,
    {
      x: 0,
      y: 0,
      width: Math.max(0, state.container.width),
      height: Math.max(0, state.container.height),
    },
    splitId,
  );

  if (!split || !rect) {
    return 0;
  }

  return split.direction === "horizontal" ? rect.width : rect.height;
}

function findSplitRect(
  node: LayoutNode,
  rect: Rect,
  splitId: NodeId,
): Rect | null {
  if (node.kind === "pane") {
    return null;
  }

  if (node.id === splitId) {
    return rect;
  }

  const sizes = normalizeSizes(node.sizes, node.children.length);
  const axisSize = node.direction === "horizontal" ? rect.width : rect.height;
  const handleTotal = Math.max(0, node.children.length - 1) * HANDLE_SIZE;
  const contentSize = Math.max(0, axisSize - handleTotal);
  let cursor = node.direction === "horizontal" ? rect.x : rect.y;

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index]!;
    const isLast = index === node.children.length - 1;
    const childSize = isLast
      ? axisEnd(rect, node.direction) - cursor
      : Math.floor(contentSize * (sizes[index] ?? 0));
    const childRect =
      node.direction === "horizontal"
        ? {
            x: cursor,
            y: rect.y,
            width: Math.max(0, childSize),
            height: rect.height,
          }
        : {
            x: rect.x,
            y: cursor,
            width: rect.width,
            height: Math.max(0, childSize),
          };
    const match = findSplitRect(child, childRect, splitId);

    if (match) {
      return match;
    }

    cursor += childSize + (isLast ? 0 : HANDLE_SIZE);
  }

  return null;
}

function axisEnd(rect: Rect, direction: Direction): number {
  return direction === "horizontal" ? rect.x + rect.width : rect.y + rect.height;
}

function mapLayout(
  node: LayoutNode,
  mapper: (node: LayoutNode) => LayoutNode,
): LayoutNode {
  if (node.kind === "pane") {
    return mapper(node);
  }

  const nextChildren = node.children.map((child) => mapLayout(child, mapper));
  return mapper({
    ...node,
    children: nextChildren,
  });
}

function markFocusedPanePath(root: LayoutNode, paneId: PaneId): LayoutNode {
  return markFocusedPanePathInner(root, paneId).node;
}

function markFocusedPanePathInner(
  node: LayoutNode,
  paneId: PaneId,
): { node: LayoutNode; contains: boolean } {
  if (node.kind === "pane") {
    return {
      node,
      contains: node.paneId === paneId,
    };
  }

  let contains = false;
  let focusedChildId: NodeId | null = null;
  let didChange = false;

  const children = node.children.map((child) => {
    const result = markFocusedPanePathInner(child, paneId);

    if (result.node !== child) {
      didChange = true;
    }

    if (result.contains) {
      contains = true;
      focusedChildId = result.node.id;
    }

    return result.node;
  });

  if (!contains) {
    return { node, contains: false };
  }

  if (node.lastFocusedChildId !== focusedChildId) {
    didChange = true;
  }

  return {
    node: didChange
      ? {
          ...node,
          children,
          lastFocusedChildId: focusedChildId ?? undefined,
        }
      : node,
    contains: true,
  };
}

function removePaneNode(node: LayoutNode, paneId: PaneId): LayoutNode | null {
  if (node.kind === "pane") {
    return node.paneId === paneId ? null : node;
  }

  const children: LayoutNode[] = [];
  const sizes: number[] = [];

  for (let i = 0; i < node.children.length; i += 1) {
    const child = removePaneNode(node.children[i]!, paneId);

    if (child) {
      children.push(child);
      sizes.push(node.sizes[i] ?? 1);
    }
  }

  if (children.length === 0) {
    return null;
  }

  if (children.length === 1) {
    return children[0]!;
  }

  return {
    ...node,
    children,
    sizes: normalizeSizes(sizes, children.length),
  };
}

function normalizeSizes(sizes: number[], expectedLength: number): number[] {
  const fallback = Array.from({ length: expectedLength }, () => 1 / expectedLength);

  if (sizes.length !== expectedLength) {
    return fallback;
  }

  const total = sizes.reduce((sum, size) => sum + Math.max(0, size), 0);

  if (total <= 0) {
    return fallback;
  }

  return sizes.map((size) => Math.max(0, size) / total);
}

function sizesEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function getMinRatio(
  node: LayoutNode,
  direction: Direction,
  totalPx: number,
): number {
  if (totalPx <= 0) {
    return 0;
  }

  return getMinimumAxisSize(node, direction) / totalPx;
}

function getMinimumAxisSize(node: LayoutNode, direction: Direction): number {
  if (node.kind === "pane") {
    return direction === "horizontal" ? node.minWidth ?? 0 : node.minHeight ?? 0;
  }

  if (node.direction === direction) {
    return (
      node.children.reduce(
        (sum, child) => sum + getMinimumAxisSize(child, direction),
        0,
      ) + Math.max(0, node.children.length - 1) * HANDLE_SIZE
    );
  }

  return Math.max(
    0,
    ...node.children.map((child) => getMinimumAxisSize(child, direction)),
  );
}

function fitNodeToAxisSize(
  node: LayoutNode,
  direction: Direction,
  axisSize: number,
): LayoutNode {
  if (node.kind === "pane") {
    return node;
  }

  if (node.direction !== direction) {
    let changed = false;
    const children = node.children.map((child) => {
      const nextChild = fitNodeToAxisSize(child, direction, axisSize);
      changed ||= nextChild !== child;
      return nextChild;
    });

    return changed ? { ...node, children } : node;
  }

  const sizes = normalizeSizes(node.sizes, node.children.length);
  const handleTotal = Math.max(0, node.children.length - 1) * HANDLE_SIZE;
  const contentSize = Math.max(0, axisSize - handleTotal);
  const minSizes = node.children.map((child) =>
    getMinimumAxisSize(child, direction),
  );
  const fittedSizes = fitSizesToMinimums(sizes, minSizes, contentSize);
  let changed = !sizesEqual(fittedSizes, sizes);

  const children = node.children.map((child, index) => {
    const childAxisSize = contentSize * (fittedSizes[index] ?? 0);
    const nextChild = fitNodeToAxisSize(child, direction, childAxisSize);
    changed ||= nextChild !== child;
    return nextChild;
  });

  return changed
    ? {
        ...node,
        children,
        sizes: fittedSizes,
      }
    : node;
}

function fitSizesToMinimums(
  sizes: number[],
  minSizes: number[],
  contentSize: number,
): number[] {
  const normalized = normalizeSizes(sizes, sizes.length);

  if (contentSize <= 0) {
    return normalized;
  }

  const desired = normalized.map((size) => size * contentSize);

  if (desired.every((size, index) => size >= (minSizes[index] ?? 0))) {
    return normalized;
  }

  const out = Array.from({ length: normalized.length }, () => 0);
  const fixed = Array.from({ length: normalized.length }, () => false);
  let remainingSize = contentSize;
  let remainingWeight = normalized.reduce((sum, size) => sum + size, 0);
  let changed = true;

  while (changed) {
    changed = false;

    for (let index = 0; index < normalized.length; index += 1) {
      if (fixed[index]) {
        continue;
      }

      const weight = remainingWeight > 0 ? normalized[index]! / remainingWeight : 0;
      const allocated = remainingSize * weight;
      const minSize = minSizes[index] ?? 0;

      if (allocated < minSize) {
        out[index] = minSize;
        fixed[index] = true;
        remainingSize -= minSize;
        remainingWeight -= normalized[index]!;
        changed = true;
      }
    }
  }

  for (let index = 0; index < normalized.length; index += 1) {
    if (fixed[index]) {
      continue;
    }

    const weight = remainingWeight > 0 ? normalized[index]! / remainingWeight : 0;
    out[index] = Math.max(0, remainingSize * weight);
  }

  const total = out.reduce((sum, size) => sum + size, 0);

  if (total <= 0) {
    return normalized;
  }

  return out.map((size) => size / total);
}

function clampAdjacentPair(
  sizes: number[],
  minSizes: number[],
  index: number,
): number[] {
  const out = [...sizes];
  const pairTotal = out[index]! + out[index + 1]!;
  const leftMin = minSizes[index] ?? 0;
  const rightMin = minSizes[index + 1] ?? 0;
  const maxLeft = Math.max(leftMin, pairTotal - rightMin);

  out[index] = Math.min(Math.max(out[index]!, leftMin), maxLeft);
  out[index + 1] = pairTotal - out[index]!;

  return normalizeSizes(out, out.length);
}
