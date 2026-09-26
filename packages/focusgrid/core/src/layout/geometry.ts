import { HANDLE_SIZE } from "./constants";
import type {
  ComputedLayout,
  ComputedNode,
  ComputedHandle,
  Orientation,
  FocusGridControllerState,
  LayoutNode,
  Rect,
} from "./types";

export function computeLayout(
  state: FocusGridControllerState,
): ComputedLayout {
  const geometry: Omit<ComputedLayout, "root"> = {
    panes: [],
    handles: [],
    rectByNodeId: new Map(),
  };

  const root = computeNode(
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
  return { ...geometry, root };
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
  direction: Orientation,
  minWidth = 0,
  minHeight = 0,
): number {
  if (node.kind === "pane") {
    return direction === "horizontal" ? minWidth : minHeight;
  }

  if (node.orientation === direction) {
    return (
      node.children.reduce(
        (sum, child) => sum + getMinimumSize(child, direction, minWidth, minHeight),
        0,
      ) + Math.max(0, node.children.length - 1) * HANDLE_SIZE
    );
  }

  return Math.max(0, ...node.children.map((child) => getMinimumSize(child, direction, minWidth, minHeight)));
}

function computeNode(
  node: LayoutNode,
  rect: Rect,
  geometry: Omit<ComputedLayout, "root">,
  activePaneId: string | null,
): ComputedNode {
  geometry.rectByNodeId.set(node.id, rect);

  if (node.kind === "pane") {
    const pane = {
      paneId: node.paneId,
      nodeId: node.id,
      rect,
      active: node.paneId === activePaneId,
    };
    geometry.panes.push(pane);
    return { kind: "pane", pane };
  }

  const sizes = normalizeSplitSizes(node.sizes, node.children.length);
  const horizontal = node.orientation === "horizontal";
  const axisSize = horizontal ? rect.width : rect.height;
  const axisStart = horizontal ? rect.x : rect.y;
  const handleTotal = Math.max(0, node.children.length - 1) * HANDLE_SIZE;
  const contentSize = Math.max(0, axisSize - handleTotal);
  let cursor = axisStart;

  const handles: ComputedHandle[] = [];
  const children = node.children.map((child, index) => {
    const isLast = index === node.children.length - 1;
    const childSize = isLast
      ? axisStart + axisSize - cursor
      : Math.floor(contentSize * (sizes[index] ?? 0));
    const childRect = createChildRect(node.orientation, rect, cursor, childSize);

    const computedChild = computeNode(child, childRect, geometry, activePaneId);
    cursor += childSize;

    if (!isLast) {
      const handle = {
        id: `${node.id}:${index}`, splitId: node.id, index, direction: node.orientation,
        rect: createChildRect(node.orientation, rect, cursor, HANDLE_SIZE),
      };
      handles.push(handle);
      geometry.handles.push(handle);
      cursor += HANDLE_SIZE;
    }
    return computedChild;
  });
  return { kind: "split", orientation: node.orientation, children, handles };
}

function createChildRect(
  direction: Orientation,
  rect: Rect,
  cursor: number,
  size: number,
): Rect {
  return direction === "horizontal"
    ? { x: cursor, y: rect.y, width: Math.max(0, size), height: rect.height }
    : { x: rect.x, y: cursor, width: rect.width, height: Math.max(0, size) };
}
