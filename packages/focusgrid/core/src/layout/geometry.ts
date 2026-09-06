import { HANDLE_SIZE } from "./constants";
import type {
  ComputedHandle,
  ComputedLayout,
  Direction,
  FocusGridControllerState,
  LayoutNode,
  NodeId,
  Rect,
  SplitNode,
} from "./types";

export type LayoutGeometry = ComputedLayout & {
  rectByNodeId: Map<NodeId, Rect>;
};

export function computeLayoutGeometry(
  state: FocusGridControllerState,
): LayoutGeometry {
  const geometry: LayoutGeometry = {
    panes: [],
    handles: [],
    rectByNodeId: new Map(),
  };

  computeNode(
    state.root,
    {
      x: 0,
      y: 0,
      width: Math.max(0, state.container.width),
      height: Math.max(0, state.container.height),
    },
    geometry,
    state.activePaneId,
  );
  return geometry;
}

export function normalizeSplitSizes(
  sizes: readonly number[],
  expectedLength: number,
): number[] {
  const fallback = () =>
    Array.from({ length: expectedLength }, () => 1 / expectedLength);

  if (sizes.length !== expectedLength) return fallback();

  const total = sizes.reduce((sum, size) => sum + Math.max(0, size), 0);
  if (total <= 0) return fallback();
  return sizes.map((size) => Math.max(0, size) / total);
}

export function getMinimumSize(
  node: LayoutNode,
  direction: Direction,
): number {
  if (node.kind === "pane") {
    return direction === "horizontal" ? node.minWidth ?? 0 : node.minHeight ?? 0;
  }

  if (node.direction === direction) {
    return (
      node.children.reduce(
        (sum, child) => sum + getMinimumSize(child, direction),
        0,
      ) + Math.max(0, node.children.length - 1) * HANDLE_SIZE
    );
  }

  return Math.max(0, ...node.children.map((child) => getMinimumSize(child, direction)));
}

function computeNode(
  node: LayoutNode,
  rect: Rect,
  geometry: LayoutGeometry,
  activePaneId: string | null,
): void {
  geometry.rectByNodeId.set(node.id, rect);

  if (node.kind === "pane") {
    geometry.panes.push({
      paneId: node.paneId,
      nodeId: node.id,
      rect,
      active: node.paneId === activePaneId,
    });
    return;
  }

  computeSplit(node, rect, geometry, activePaneId);
}

function computeSplit(
  node: SplitNode,
  rect: Rect,
  geometry: LayoutGeometry,
  activePaneId: string | null,
): void {
  const sizes = normalizeSplitSizes(node.sizes, node.children.length);
  const axisSize = node.direction === "horizontal" ? rect.width : rect.height;
  const handleTotal = Math.max(0, node.children.length - 1) * HANDLE_SIZE;
  const contentSize = Math.max(0, axisSize - handleTotal);
  let cursor = node.direction === "horizontal" ? rect.x : rect.y;

  node.children.forEach((child, index) => {
    const isLast = index === node.children.length - 1;
    const childSize = isLast
      ? axisEnd(rect, node.direction) - cursor
      : Math.floor(contentSize * (sizes[index] ?? 0));
    const childRect = createChildRect(node.direction, rect, cursor, childSize);

    computeNode(child, childRect, geometry, activePaneId);
    cursor += childSize;

    if (!isLast) {
      geometry.handles.push(createHandle(node, index, getHandleRect(node.direction, rect, cursor)));
      cursor += HANDLE_SIZE;
    }
  });
}

function createChildRect(
  direction: Direction,
  rect: Rect,
  cursor: number,
  size: number,
): Rect {
  return direction === "horizontal"
    ? { x: cursor, y: rect.y, width: Math.max(0, size), height: rect.height }
    : { x: rect.x, y: cursor, width: rect.width, height: Math.max(0, size) };
}

function createHandle(split: SplitNode, index: number, rect: Rect): ComputedHandle {
  return {
    id: `${split.id}:${index}`,
    splitId: split.id,
    index,
    rect,
    direction: split.direction,
  };
}

function getHandleRect(direction: Direction, rect: Rect, cursor: number): Rect {
  return direction === "horizontal"
    ? { x: cursor, y: rect.y, width: HANDLE_SIZE, height: rect.height }
    : { x: rect.x, y: cursor, width: rect.width, height: HANDLE_SIZE };
}

function axisEnd(rect: Rect, direction: Direction): number {
  return direction === "horizontal" ? rect.x + rect.width : rect.y + rect.height;
}
