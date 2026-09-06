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
  return buildLayoutIndex(root).paneNodeByPaneId.get(paneId) ?? null;
}

export function findSplitNode(
  root: LayoutNode,
  splitId: NodeId,
): SplitNode | null {
  const node = buildLayoutIndex(root).nodeById.get(splitId);
  return node?.kind === "split" ? node : null;
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
