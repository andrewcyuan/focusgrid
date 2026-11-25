import { normalizeSplitSizes } from "./geometry";
import type { LayoutNode, NodeId, PaneId, PaneNode, SplitNode } from "./types";

export type PanePathStep = { split: SplitNode; childIndex: number };

export function findNode(root: LayoutNode, nodeId: NodeId): LayoutNode | null {
  if (root.id === nodeId) return root;
  if (root.kind === "pane") return null;
  for (const child of root.children) {
    const node = findNode(child, nodeId);
    if (node) return node;
  }
  return null;
}

export function findPaneNode(root: LayoutNode, paneId: PaneId | null): PaneNode | null {
  if (!paneId) return null;
  if (root.kind === "pane") return root.paneId === paneId ? root : null;
  for (const child of root.children) {
    const pane = findPaneNode(child, paneId);
    if (pane) return pane;
  }
  return null;
}

export function findPanePath(root: LayoutNode, paneId: PaneId): PanePathStep[] | null {
  if (root.kind === "pane") return root.paneId === paneId ? [] : null;
  for (const [childIndex, child] of root.children.entries()) {
    const path = findPanePath(child, paneId);
    if (path) return [{ split: root, childIndex }, ...path];
  }
  return null;
}

export function collectPaneIds(root: LayoutNode): PaneId[] {
  if (root.kind === "pane") return [root.paneId];
  return root.children.flatMap(collectPaneIds);
}

export function transformLayout(node: LayoutNode, transform: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (node.kind === "pane") return transform(node);

  let childrenChanged = false;
  const children = node.children.map((child) => {
    const nextChild = transformLayout(child, transform);
    childrenChanged ||= nextChild !== child;
    return nextChild;
  });
  return transform(childrenChanged ? { ...node, children } : node);
}

export function updatePane(root: LayoutNode, paneId: PaneId, update: (pane: PaneNode) => LayoutNode): LayoutNode {
  return transformLayout(root, (node) => (node.kind === "pane" && node.paneId === paneId ? update(node) : node));
}

export function markFocusedPanePath(root: LayoutNode, paneId: PaneId | null): LayoutNode {
  const path = paneId ? findPanePath(root, paneId) : null;
  if (!path) return root;
  const focusedChildIds = new Map(path.map(({ split, childIndex }) => [split.id, split.children[childIndex]!.id]));
  return transformLayout(root, (node) => {
    const focusedChildId = focusedChildIds.get(node.id);
    return node.kind === "split" && focusedChildId !== undefined && node.lastFocusedChildId !== focusedChildId
      ? { ...node, lastFocusedChildId: focusedChildId }
      : node;
  });
}

export function removePaneNode(node: LayoutNode, paneId: PaneId): LayoutNode | null {
  if (node.kind === "pane") return node.paneId === paneId ? null : node;

  const children: LayoutNode[] = [];
  const sizes: number[] = [];
  node.children.forEach((child, index) => {
    const nextChild = removePaneNode(child, paneId);
    if (nextChild) {
      children.push(nextChild);
      sizes.push(node.sizes[index] ?? 1);
    }
  });

  if (children.length <= 1) return children[0] ?? null;
  return { ...node, children, sizes: normalizeSplitSizes(sizes, children.length) };
}
