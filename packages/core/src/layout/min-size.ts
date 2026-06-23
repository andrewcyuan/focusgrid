import type { Direction, LayoutNode } from "./types";

export function getMinimumSize(node: LayoutNode, direction: Direction): number {
  if (node.kind === "pane") {
    return direction === "horizontal" ? node.minWidth ?? 0 : node.minHeight ?? 0;
  }

  if (node.direction === direction) {
    return node.children.reduce(
      (sum, child) => sum + getMinimumSize(child, direction),
      0,
    );
  }

  return Math.max(...node.children.map((child) => getMinimumSize(child, direction)));
}
