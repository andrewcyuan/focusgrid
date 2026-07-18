import type { Direction, LayoutNode } from "./types";
import { HANDLE_SIZE } from "./constants";

export function getMinimumSize(node: LayoutNode, direction: Direction): number {
  if (node.kind === "pane") {
    return direction === "horizontal" ? node.minWidth ?? 0 : node.minHeight ?? 0;
  }

  if (node.direction === direction) {
    return node.children.reduce(
      (sum, child) => sum + getMinimumSize(child, direction),
      0,
    ) + Math.max(0, node.children.length - 1) * HANDLE_SIZE;
  }

  return Math.max(...node.children.map((child) => getMinimumSize(child, direction)));
}
