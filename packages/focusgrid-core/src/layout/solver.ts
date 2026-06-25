import type {
  ComputedHandle,
  ComputedLayout,
  Direction,
  LayoutNode,
  Rect,
  SplitNode,
  WorkspaceState,
} from "./types";
import { HANDLE_SIZE } from "./constants";

export function computeLayout(state: WorkspaceState): ComputedLayout {
  const out: ComputedLayout = {
    panes: [],
    handles: [],
  };

  computeNode(
    state.root,
    {
      x: 0,
      y: 0,
      width: Math.max(0, state.container.width),
      height: Math.max(0, state.container.height),
    },
    out,
    state,
  );

  return out;
}

function computeNode(
  node: LayoutNode,
  rect: Rect,
  out: ComputedLayout,
  state: WorkspaceState,
): void {
  if (node.kind === "pane") {
    out.panes.push({
      paneId: node.paneId,
      nodeId: node.id,
      rect,
      active: node.paneId === state.activePaneId,
    });
    return;
  }

  computeSplit(node, rect, out, state);
}

function computeSplit(
  node: SplitNode,
  rect: Rect,
  out: ComputedLayout,
  state: WorkspaceState,
): void {
  const sizes = normalizeSizes(node.sizes, node.children.length);
  const axisSize = node.direction === "horizontal" ? rect.width : rect.height;
  const handleTotal = Math.max(0, node.children.length - 1) * HANDLE_SIZE;
  const contentSize = Math.max(0, axisSize - handleTotal);
  let cursor = node.direction === "horizontal" ? rect.x : rect.y;

  node.children.forEach((child, index) => {
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

    computeNode(child, childRect, out, state);
    cursor += childSize;

    if (!isLast) {
      const handleRect = getHandleRect(node.direction, rect, cursor);
      out.handles.push(createHandle(node, index, handleRect));
      cursor += HANDLE_SIZE;
    }
  });
}

function createHandle(
  split: SplitNode,
  index: number,
  rect: Rect,
): ComputedHandle {
  return {
    id: `${split.id}:${index}`,
    splitId: split.id,
    index,
    rect,
    direction: split.direction,
  };
}

function getHandleRect(direction: Direction, rect: Rect, cursor: number): Rect {
  if (direction === "horizontal") {
    return {
      x: cursor,
      y: rect.y,
      width: HANDLE_SIZE,
      height: rect.height,
    };
  }

  return {
    x: rect.x,
    y: cursor,
    width: rect.width,
    height: HANDLE_SIZE,
  };
}

function axisEnd(rect: Rect, direction: Direction): number {
  return direction === "horizontal" ? rect.x + rect.width : rect.y + rect.height;
}

function normalizeSizes(sizes: number[], expectedLength: number): number[] {
  if (sizes.length !== expectedLength) {
    return Array.from({ length: expectedLength }, () => 1 / expectedLength);
  }

  const total = sizes.reduce((sum, size) => sum + Math.max(0, size), 0);

  if (total <= 0) {
    return Array.from({ length: expectedLength }, () => 1 / expectedLength);
  }

  return sizes.map((size) => Math.max(0, size) / total);
}
