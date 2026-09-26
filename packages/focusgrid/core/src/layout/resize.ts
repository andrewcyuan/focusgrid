import { HANDLE_SIZE } from "./constants";
import { getMinimumSize, normalizeSplitSizes } from "./geometry";
import type { Direction, LayoutNode, SplitNode } from "./types";

export function resizeSplit(
  split: SplitNode,
  totalPx: number,
  index: number,
  deltaPx: number,
  snapshotSizes?: number[],
): SplitNode {
  if (totalPx <= 0 || index < 0 || index >= split.children.length - 1) return split;
  const baseSizes = normalizeSplitSizes(
    snapshotSizes ?? split.sizes,
    split.children.length
  );
  const deltaRatio = deltaPx / totalPx;
  const nextSizes = [...baseSizes];
  nextSizes[index] += deltaRatio;
  nextSizes[index + 1] -= deltaRatio;

  const minSizes = split.children.map((child) =>
    getMinimumSize(child, split.direction) / totalPx
  );
  const currentSizes = normalizeSplitSizes(split.sizes, split.children.length);
  const clamped = clampAdjacentPair(nextSizes, minSizes, index);
  const fitted = fitNodeToAxisSize(
    {
      ...split,
      sizes: clamped,
    },
    split.direction,
    totalPx
  );

  if (fitted.kind !== "split" || sizesEqual(fitted.sizes, currentSizes)) {
    return split;
  }

  return fitted;
}

function sizesEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function fitNodeToAxisSize(
  node: LayoutNode,
  direction: Direction,
  axisSize: number
): LayoutNode {
  if (node.kind === "pane") {
    return node;
  }

  if (node.direction !== direction) {
    let changed = false;
    const children = node.children.map((child) => {
      const nextChild = fitNodeToAxisSize(child, direction, axisSize);
      changed ||= nextChild !== child;
      return nextChild;
    });

    return changed ? { ...node, children } : node;
  }

  const sizes = normalizeSplitSizes(node.sizes, node.children.length);
  const handleTotal = Math.max(0, node.children.length - 1) * HANDLE_SIZE;
  const contentSize = Math.max(0, axisSize - handleTotal);
  const minSizes = node.children.map((child) =>
    getMinimumSize(child, direction)
  );
  const fittedSizes = fitSizesToMinimums(sizes, minSizes, contentSize);
  let changed = !sizesEqual(fittedSizes, sizes);

  const children = node.children.map((child, index) => {
    const childAxisSize = contentSize * (fittedSizes[index] ?? 0);
    const nextChild = fitNodeToAxisSize(child, direction, childAxisSize);
    changed ||= nextChild !== child;
    return nextChild;
  });

  return changed
    ? {
      ...node,
      children,
      sizes: fittedSizes,
    }
    : node;
}

function fitSizesToMinimums(
  sizes: number[],
  minSizes: number[],
  contentSize: number
): number[] {
  const normalized = normalizeSplitSizes(sizes, sizes.length);

  if (contentSize <= 0) {
    return normalized;
  }

  const desired = normalized.map((size) => size * contentSize);

  if (desired.every((size, index) => size >= (minSizes[index] ?? 0))) {
    return normalized;
  }

  const out = Array.from({ length: normalized.length }, () => 0);
  const fixed = Array.from({ length: normalized.length }, () => false);
  let remainingSize = contentSize;
  let remainingWeight = normalized.reduce((sum, size) => sum + size, 0);
  let changed = true;

  while (changed) {
    changed = false;

    for (let index = 0; index < normalized.length; index += 1) {
      if (fixed[index]) {
        continue;
      }

      const weight =
        remainingWeight > 0 ? normalized[index]! / remainingWeight : 0;
      const allocated = remainingSize * weight;
      const minSize = minSizes[index] ?? 0;

      if (allocated < minSize) {
        out[index] = minSize;
        fixed[index] = true;
        remainingSize -= minSize;
        remainingWeight -= normalized[index]!;
        changed = true;
      }
    }
  }

  for (let index = 0; index < normalized.length; index += 1) {
    if (fixed[index]) {
      continue;
    }

    const weight =
      remainingWeight > 0 ? normalized[index]! / remainingWeight : 0;
    out[index] = Math.max(0, remainingSize * weight);
  }

  const total = out.reduce((sum, size) => sum + size, 0);

  if (total <= 0) {
    return normalized;
  }

  return out.map((size) => size / total);
}

function clampAdjacentPair(
  sizes: number[],
  minSizes: number[],
  index: number
): number[] {
  const out = [...sizes];
  const pairTotal = out[index]! + out[index + 1]!;
  const leftMin = minSizes[index] ?? 0;
  const rightMin = minSizes[index + 1] ?? 0;
  const maxLeft = Math.max(leftMin, pairTotal - rightMin);

  out[index] = Math.min(Math.max(out[index]!, leftMin), maxLeft);
  out[index + 1] = pairTotal - out[index]!;

  return normalizeSplitSizes(out, out.length);
}
