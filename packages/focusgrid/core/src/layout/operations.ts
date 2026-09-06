import { HANDLE_SIZE } from "./constants";
import {
  computeLayoutGeometry,
  getMinimumSize,
  normalizeSplitSizes,
} from "./geometry";
import {
  buildLayoutIndex,
  collectPaneIds,
  findSplitNode,
  transformLayout,
  updatePane,
} from "./tree";
import { findPaneInDirection } from "./navigation";
import type {
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
  PaneCommandCapabilityInput,
  SplitNode,
  FocusGridControllerState,
} from "./types";
import { patchPaneCapabilities } from "../pane-guards";

export function focusPane(
  state: FocusGridControllerState,
  paneId: PaneId
): FocusGridControllerState {
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
  direction: PaneFocusDirection
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
    targetPaneId
  );
}

export type SplitPaneOptions = PaneCommandCapabilityInput & {
  side: PaneSplitSide;
  newPaneId?: PaneId;
  minWidth?: number;
  minHeight?: number;
  data?: unknown;
  preserveActivePane?: boolean;
};

export type WrapRootInSplitOptions = PaneCommandCapabilityInput & {
  side: PaneSplitSide;
  newPaneId?: PaneId;
  minWidth?: number;
  minHeight?: number;
  data?: unknown;
  preserveActivePane?: boolean;
};

type ResolvedNewPaneIds = {
  newPaneId: PaneId;
  newPaneNodeId: NodeId;
  splitId: NodeId;
};

export type ResizePaneOptions = {
  direction: PaneResizeDirection;
  deltaPx: number;
};

export type UpdatePaneCommandGuardsOptions = PaneCommandCapabilityInput;

export function splitPane(
  state: FocusGridControllerState,
  paneId: PaneId,
  options: SplitPaneOptions & ResolvedNewPaneIds
): FocusGridControllerState {
  const newPaneId = options.newPaneId;
  const direction = splitSideToDirection(options.side);
  const index = buildLayoutIndex(state.root);

  if (index.paneNodeByPaneId.has(newPaneId)) {
    return state;
  }

  const nextRoot = updatePane(state.root, paneId, (node) => {
    const originalPane = node;

    const newPane = createPaneNode(options, {
      minWidth: node.minWidth,
      minHeight: node.minHeight,
    });

    return {
      kind: "split",
      id: options.splitId,
      direction,
      children:
        options.side === "left" || options.side === "up"
          ? [newPane, originalPane]
          : [originalPane, newPane],
      sizes: [0.5, 0.5],
    };
  });

  if (nextRoot === state.root) {
    return state;
  }

  const activePaneId = options.preserveActivePane
    ? state.activePaneId
    : newPaneId;

  return {
    ...state,
    root: activePaneId ? markFocusedPanePath(nextRoot, activePaneId) : nextRoot,
    activePaneId,
  };
}

export function wrapRootInSplit(
  state: FocusGridControllerState,
  options: WrapRootInSplitOptions & ResolvedNewPaneIds
): FocusGridControllerState {
  const newPaneId = options.newPaneId;
  const index = buildLayoutIndex(state.root);

  if (index.paneNodeByPaneId.has(newPaneId)) {
    return state;
  }

  const newPane = createPaneNode(options);
  const direction = splitSideToDirection(options.side);
  const nextRoot: SplitNode = {
    kind: "split",
    id: options.splitId,
    direction,
    children:
      options.side === "left" || options.side === "up"
        ? [newPane, state.root]
        : [state.root, newPane],
    sizes: [0.5, 0.5],
  };
  const activePaneId = options.preserveActivePane
    ? state.activePaneId
    : newPaneId;

  return {
    ...state,
    root: activePaneId ? markFocusedPanePath(nextRoot, activePaneId) : nextRoot,
    activePaneId,
  };
}

export function removePane(
  state: FocusGridControllerState,
  paneId: PaneId
): FocusGridControllerState {
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
  options: UpdatePaneCommandGuardsOptions
): FocusGridControllerState {
  const nextRoot = updatePane(state.root, paneId, (pane) =>
    patchPaneCapabilities(pane, options),
  );
  return nextRoot === state.root ? state : { ...state, root: nextRoot };
}

export function swapPanes(
  state: FocusGridControllerState,
  firstPaneId: PaneId,
  secondPaneId: PaneId
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

  const nextRoot = transformLayout(state.root, (node) => {
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
  direction: PaneSwapDirection
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
  snapshotSizes?: number[]
): FocusGridControllerState {
  const nextRoot = transformLayout(state.root, (node) => {
    if (node.kind !== "split" || node.id !== splitId) {
      return node;
    }

    const totalPx = getSplitAxisSize(state, splitId);

    if (totalPx <= 0 || index < 0 || index >= node.children.length - 1) {
      return node;
    }

    const baseSizes = normalizeSplitSizes(
      snapshotSizes ?? node.sizes,
      node.children.length
    );
    const deltaRatio = deltaPx / totalPx;
    const nextSizes = [...baseSizes];
    nextSizes[index] += deltaRatio;
    nextSizes[index + 1] -= deltaRatio;

    const minSizes = node.children.map((child) =>
      getMinRatio(child, node.direction, totalPx)
    );
    const currentSizes = normalizeSplitSizes(node.sizes, node.children.length);
    const clamped = clampAdjacentPair(nextSizes, minSizes, index);
    const fitted = fitNodeToAxisSize(
      {
        ...node,
        sizes: clamped,
      },
      node.direction,
      totalPx
    );

    if (fitted.kind !== "split" || sizesEqual(fitted.sizes, currentSizes)) {
      return node;
    }

    return fitted;
  });

  if (nextRoot === state.root) {
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
  options: ResizePaneOptions
): FocusGridControllerState {
  const index = buildLayoutIndex(state.root);
  const paneNode = index.paneNodeByPaneId.get(paneId);

  if (!paneNode) {
    return state;
  }

  const boundary = resolvePaneResizeBoundary(
    index,
    paneNode.id,
    options.direction
  );

  if (!boundary) {
    return state;
  }

  return resizeHandle(
    state,
    boundary.splitId,
    boundary.index,
    boundary.deltaPxSign * options.deltaPx
  );
}

function splitSideToDirection(side: PaneSplitSide): Direction {
  return side === "left" || side === "right" ? "horizontal" : "vertical";
}

function createPaneNode(
  options: (SplitPaneOptions | WrapRootInSplitOptions) & ResolvedNewPaneIds,
  defaults: Pick<PaneNode, "minWidth" | "minHeight"> = {},
): PaneNode {
  return patchPaneCapabilities(
    {
      kind: "pane",
      id: options.newPaneNodeId,
      paneId: options.newPaneId,
      minWidth: options.minWidth ?? defaults.minWidth,
      minHeight: options.minHeight ?? defaults.minHeight,
      data: options.data,
    },
    options,
  );
}

function resolvePaneResizeBoundary(
  index: LayoutIndex,
  nodeId: NodeId,
  direction: PaneResizeDirection
): { splitId: NodeId; index: number; deltaPxSign: 1 | -1 } | null {
  let currentId = nodeId;
  let parent = index.parentByNodeId.get(currentId) ?? null;

  while (parent) {
    const childIndex = parent.children.findIndex(
      (child) => child.id === currentId
    );

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

function isHorizontalResize(direction: PaneResizeDirection): boolean {
  return direction === "left" || direction === "right";
}

function isPositiveBoundaryDirection(direction: PaneResizeDirection): boolean {
  return direction === "right" || direction === "down";
}

function getSplitAxisSize(
  state: FocusGridControllerState,
  splitId: NodeId
): number {
  const split = findSplitNode(state.root, splitId);
  const rect = computeLayoutGeometry(state).rectByNodeId.get(splitId);

  if (!split || !rect) {
    return 0;
  }

  return split.direction === "horizontal" ? rect.width : rect.height;
}

function markFocusedPanePath(root: LayoutNode, paneId: PaneId): LayoutNode {
  return markFocusedPanePathInner(root, paneId).node;
}

function markFocusedPanePathInner(
  node: LayoutNode,
  paneId: PaneId
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
    sizes: normalizeSplitSizes(sizes, children.length),
  };
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
  totalPx: number
): number {
  if (totalPx <= 0) {
    return 0;
  }

  return getMinimumSize(node, direction) / totalPx;
}

function fitNodeToAxisSize(
  node: LayoutNode,
  direction: Direction,
  axisSize: number
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

  const sizes = normalizeSplitSizes(node.sizes, node.children.length);
  const handleTotal = Math.max(0, node.children.length - 1) * HANDLE_SIZE;
  const contentSize = Math.max(0, axisSize - handleTotal);
  const minSizes = node.children.map((child) =>
    getMinimumSize(child, direction)
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
  contentSize: number
): number[] {
  const normalized = normalizeSplitSizes(sizes, sizes.length);

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

      const weight =
        remainingWeight > 0 ? normalized[index]! / remainingWeight : 0;
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

    const weight =
      remainingWeight > 0 ? normalized[index]! / remainingWeight : 0;
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
  index: number
): number[] {
  const out = [...sizes];
  const pairTotal = out[index]! + out[index + 1]!;
  const leftMin = minSizes[index] ?? 0;
  const rightMin = minSizes[index + 1] ?? 0;
  const maxLeft = Math.max(leftMin, pairTotal - rightMin);

  out[index] = Math.min(Math.max(out[index]!, leftMin), maxLeft);
  out[index + 1] = pairTotal - out[index]!;

  return normalizeSplitSizes(out, out.length);
}
