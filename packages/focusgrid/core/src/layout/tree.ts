import { normalizeSplitSizes } from "./geometry";
import type {
  LayoutIndex,
  LayoutNode,
  NodeId,
  PaneId,
  PaneNode,
  SplitNode,
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

export function findPaneNode(
  root: LayoutNode,
  paneId: PaneId | null,
): PaneNode | null {
  if (!paneId) return null;
  if (root.kind === "pane") return root.paneId === paneId ? root : null;
  for (const child of root.children) {
    const pane = findPaneNode(child, paneId);
    if (pane) return pane;
  }
  return null;
}

export function findSplitNode(
  root: LayoutNode,
  splitId: NodeId,
): SplitNode | null {
  if (root.kind === "pane") return null;
  if (root.id === splitId) return root;
  for (const child of root.children) {
    const split = findSplitNode(child, splitId);
    if (split) return split;
  }
  return null;
}

export function collectPaneIds(root: LayoutNode): PaneId[] {
  if (root.kind === "pane") return [root.paneId];
  return root.children.flatMap(collectPaneIds);
}

export function transformLayout(
  node: LayoutNode,
  transform: (node: LayoutNode) => LayoutNode,
): LayoutNode {
  if (node.kind === "pane") return transform(node);

  let childrenChanged = false;
  const children = node.children.map((child) => {
    const nextChild = transformLayout(child, transform);
    childrenChanged ||= nextChild !== child;
    return nextChild;
  });
  const nextNode = childrenChanged ? { ...node, children } : node;
  return transform(nextNode);
}

export function updatePane(
  root: LayoutNode,
  paneId: PaneId,
  update: (pane: PaneNode) => LayoutNode,
): LayoutNode {
  return transformLayout(root, (node) =>
    node.kind === "pane" && node.paneId === paneId ? update(node) : node,
  );
}

export function markFocusedPanePath(root: LayoutNode, paneId: PaneId): LayoutNode {
  const index = buildLayoutIndex(root);
  const pane = index.paneNodeByPaneId.get(paneId);
  if (!pane) return root;
  const path = new Map<NodeId, NodeId>();
  let childId = pane.id;
  let parent = index.parentByNodeId.get(childId);
  while (parent) {
    path.set(parent.id, childId);
    childId = parent.id;
    parent = index.parentByNodeId.get(childId);
  }
  return transformLayout(root, (node) => {
    const focusedChildId = path.get(node.id);
    return node.kind === "split" && focusedChildId !== undefined && node.lastFocusedChildId !== focusedChildId
      ? { ...node, lastFocusedChildId: focusedChildId }
      : node;
  });
}

export function removePaneNode(node: LayoutNode, paneId: PaneId): LayoutNode | null {
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
