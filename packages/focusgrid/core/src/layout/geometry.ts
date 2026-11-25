import type {
  ComputedHandle,
  ComputedLayout,
  ComputedNode,
  FocusGridControllerState,
  LayoutNode,
  Orientation,
  PaneId,
  Rect,
  SplitNode,
} from "./types";

const HANDLE_SIZE = 3;

type LayoutCollector = Omit<ComputedLayout, "root">;

export function computeLayout(state: FocusGridControllerState): ComputedLayout {
  const collector: LayoutCollector = { panes: [], handles: [], rectByNodeId: new Map() };
  const rect = {
    x: 0,
    y: 0,
    width: Math.max(0, state.container.width),
    height: Math.max(0, state.container.height),
  };
  const root = computeNode(state.root, rect, collector, state.activePaneId);
  return { ...collector, root };
}

export function normalizeSplitSizes(sizes: readonly number[], expectedLength: number): number[] {
  const total = sizes.reduce((sum, size) => sum + Math.max(0, size), 0);
  if (sizes.length !== expectedLength || total <= 0) {
    return Array.from({ length: expectedLength }, () => 1 / expectedLength);
  }
  return sizes.map((size) => Math.max(0, size) / total);
}

export function getHandlesSize(split: SplitNode): number {
  return Math.max(0, split.children.length - 1) * HANDLE_SIZE;
}

function computeNode(
  node: LayoutNode,
  rect: Rect,
  collector: LayoutCollector,
  activePaneId: PaneId | null,
): ComputedNode {
  collector.rectByNodeId.set(node.id, rect);

  if (node.kind === "pane") {
    const pane = { paneId: node.paneId, nodeId: node.id, rect, active: node.paneId === activePaneId };
    collector.panes.push(pane);
    return { kind: "pane", pane };
  }

  const sizes = normalizeSplitSizes(node.sizes, node.children.length);
  const horizontal = node.orientation === "horizontal";
  const axisSize = horizontal ? rect.width : rect.height;
  const axisStart = horizontal ? rect.x : rect.y;
  const contentSize = Math.max(0, axisSize - getHandlesSize(node));
  let cursor = axisStart;

  const handles: ComputedHandle[] = [];
  const children = node.children.map((child, index) => {
    const isLast = index === node.children.length - 1;
    const childSize = isLast ? axisStart + axisSize - cursor : Math.floor(contentSize * (sizes[index] ?? 0));
    const computedChild = computeNode(
      child,
      createChildRect(node.orientation, rect, cursor, childSize),
      collector,
      activePaneId,
    );
    cursor += childSize;

    if (!isLast) {
      const handle = {
        id: `${node.id}:${index}`,
        splitId: node.id,
        index,
        direction: node.orientation,
        rect: createChildRect(node.orientation, rect, cursor, HANDLE_SIZE),
      };
      handles.push(handle);
      collector.handles.push(handle);
      cursor += HANDLE_SIZE;
    }
    return computedChild;
  });
  return { kind: "split", orientation: node.orientation, children, handles };
}

function createChildRect(direction: Orientation, rect: Rect, cursor: number, size: number): Rect {
  return direction === "horizontal"
    ? { x: cursor, y: rect.y, width: Math.max(0, size), height: rect.height }
    : { x: rect.x, y: cursor, width: rect.width, height: Math.max(0, size) };
}
