import { createId } from "../utils/ids";
import { HANDLE_SIZE } from "./constants";
import type {
  Direction,
  LayoutIndex,
  LayoutNode,
  NodeId,
  PaneId,
  PaneResizeDirection,
  PaneNode,
  Rect,
  SplitNode,
  WorkspaceState,
} from "./types";

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

export function focusPane(state: WorkspaceState, paneId: PaneId): WorkspaceState {
  if (!buildLayoutIndex(state.root).paneNodeByPaneId.has(paneId)) {
    return state;
  }

  if (state.activePaneId === paneId) {
    return state;
  }

  return {
    ...state,
    activePaneId: paneId,
  };
}

export function splitPane(
  state: WorkspaceState,
  paneId: PaneId,
  direction: Direction,
  newPaneId: PaneId,
): WorkspaceState {
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
    };

    return {
      kind: "split",
      id: createId("split"),
      direction,
      children: [originalPane, newPane],
      sizes: [0.5, 0.5],
    };
  });

  if (!didSplit) {
    return state;
  }

  return {
    ...state,
    root: nextRoot,
    activePaneId: newPaneId,
  };
}

export function closePane(state: WorkspaceState, paneId: PaneId): WorkspaceState {
  const panes = collectPaneIds(state.root);

  if (!panes.includes(paneId) || panes.length <= 1) {
    return state;
  }

  const nextRoot = removePane(state.root, paneId);

  if (!nextRoot) {
    return state;
  }

  const nextPanes = collectPaneIds(nextRoot);
  const activePaneId =
    state.activePaneId === paneId ? nextPanes[0] ?? null : state.activePaneId;

  return {
    ...state,
    root: nextRoot,
    activePaneId,
  };
}

export function resizeHandle(
  state: WorkspaceState,
  splitId: NodeId,
  index: number,
  deltaPx: number,
  snapshotSizes?: number[],
): WorkspaceState {
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

    const clamped = clampAdjacentPair(nextSizes, minSizes, index);

    if (sizesEqual(clamped, normalizeSizes(node.sizes, node.children.length))) {
      return node;
    }

    didResize = true;

    return {
      ...node,
      sizes: clamped,
    };
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
  state: WorkspaceState,
  paneId: PaneId,
  direction: PaneResizeDirection,
  deltaPx: number,
): WorkspaceState {
  const index = buildLayoutIndex(state.root);
  const paneNode = index.paneNodeByPaneId.get(paneId);

  if (!paneNode) {
    return state;
  }

  const boundary = findPaneResizeBoundary(index, paneNode.id, direction);

  if (!boundary) {
    return state;
  }

  return resizeHandle(
    state,
    boundary.splitId,
    boundary.index,
    boundary.deltaPxSign * deltaPx,
  );
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

function findPaneResizeBoundary(
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

    if (isHorizontalResize(direction) && parent.direction === "horizontal") {
      if (direction === "right" && childIndex < parent.children.length - 1) {
        return { splitId: parent.id, index: childIndex, deltaPxSign: 1 };
      }

      if (direction === "left" && childIndex > 0) {
        return { splitId: parent.id, index: childIndex - 1, deltaPxSign: -1 };
      }
    }

    if (!isHorizontalResize(direction) && parent.direction === "vertical") {
      if (direction === "down" && childIndex < parent.children.length - 1) {
        return { splitId: parent.id, index: childIndex, deltaPxSign: 1 };
      }

      if (direction === "up" && childIndex > 0) {
        return { splitId: parent.id, index: childIndex - 1, deltaPxSign: -1 };
      }
    }

    currentId = parent.id;
    parent = index.parentByNodeId.get(currentId) ?? null;
  }

  return null;
}

function isHorizontalResize(direction: PaneResizeDirection): boolean {
  return direction === "left" || direction === "right";
}

function getSplitAxisSize(state: WorkspaceState, splitId: NodeId): number {
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

function removePane(node: LayoutNode, paneId: PaneId): LayoutNode | null {
  if (node.kind === "pane") {
    return node.paneId === paneId ? null : node;
  }

  const children: LayoutNode[] = [];
  const sizes: number[] = [];

  for (let i = 0; i < node.children.length; i += 1) {
    const child = removePane(node.children[i]!, paneId);

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

  if (node.kind === "pane") {
    const px = direction === "horizontal" ? node.minWidth ?? 0 : node.minHeight ?? 0;
    return Math.max(0, px / totalPx);
  }

  return node.children.reduce(
    (sum, child) => sum + getMinRatio(child, direction, totalPx),
    0,
  );
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
