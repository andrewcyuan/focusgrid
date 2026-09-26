import { HANDLE_SIZE } from "./constants";
import type {
  ComputedLayout,
  Direction,
  FocusGridControllerState,
  LayoutNode,
  Rect,
} from "./types";

export function computeLayout(
  state: FocusGridControllerState,
): ComputedLayout {
  const geometry: ComputedLayout = {
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
  geometry: ComputedLayout,
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

  const sizes = normalizeSplitSizes(node.sizes, node.children.length);
  const horizontal = node.direction === "horizontal";
  const axisSize = horizontal ? rect.width : rect.height;
  const axisStart = horizontal ? rect.x : rect.y;
  const handleTotal = Math.max(0, node.children.length - 1) * HANDLE_SIZE;
  const contentSize = Math.max(0, axisSize - handleTotal);
  let cursor = axisStart;

  node.children.forEach((child, index) => {
    const isLast = index === node.children.length - 1;
    const childSize = isLast
      ? axisStart + axisSize - cursor
      : Math.floor(contentSize * (sizes[index] ?? 0));
    const childRect = createChildRect(node.direction, rect, cursor, childSize);

    computeNode(child, childRect, geometry, activePaneId);
    cursor += childSize;

    if (!isLast) {
      geometry.handles.push({
        id: `${node.id}:${index}`, splitId: node.id, index, direction: node.direction,
        rect: createChildRect(node.direction, rect, cursor, HANDLE_SIZE),
      });
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
