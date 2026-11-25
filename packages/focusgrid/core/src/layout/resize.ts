import { getHandlesSize, normalizeSplitSizes } from "./geometry";
import type { LayoutNode, Orientation, SplitNode } from "./types";

export function getMinimumSize(node: LayoutNode, direction: Orientation, paneMinSize: number): number {
  if (node.kind === "pane") return paneMinSize;
  const childMinimums = node.children.map((child) => getMinimumSize(child, direction, paneMinSize));
  if (node.orientation !== direction) return Math.max(0, ...childMinimums);
  return childMinimums.reduce((sum, size) => sum + size, 0) + getHandlesSize(node);
}

export function resizeSplit(
  split: SplitNode,
  totalPx: number,
  index: number,
  deltaPx: number,
  snapshotSizes: number[] | undefined,
  paneMinSize: number,
): SplitNode {
  if (totalPx <= 0 || index < 0 || index >= split.children.length - 1) return split;
  const nextSizes = normalizeSplitSizes(snapshotSizes ?? split.sizes, split.children.length);
  const deltaRatio = deltaPx / totalPx;
  nextSizes[index] += deltaRatio;
  nextSizes[index + 1] -= deltaRatio;

  const minSizes = split.children.map((child) => getMinimumSize(child, split.orientation, paneMinSize) / totalPx);
  const fitted = fitSplitToAxisSize(
    { ...split, sizes: clampAdjacentPair(nextSizes, minSizes, index) },
    split.orientation,
    totalPx,
    paneMinSize,
  );
  return sizesEqual(fitted.sizes, normalizeSplitSizes(split.sizes, split.children.length)) ? split : fitted;
}

function sizesEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function fitSplitToAxisSize(
  split: SplitNode,
  direction: Orientation,
  axisSize: number,
  paneMinSize: number,
): SplitNode {
  const sameAxis = split.orientation === direction;
  const contentSize = Math.max(0, axisSize - getHandlesSize(split));
  const normalized = normalizeSplitSizes(split.sizes, split.children.length);
  const sizes = sameAxis
    ? fitSizesToMinimums(
        normalized,
        split.children.map((child) => getMinimumSize(child, direction, paneMinSize)),
        contentSize,
      )
    : split.sizes;
  let changed = sameAxis && !sizesEqual(sizes, normalized);

  const children = split.children.map((child, index) => {
    if (child.kind === "pane") return child;
    const childAxisSize = sameAxis ? contentSize * (sizes[index] ?? 0) : axisSize;
    const nextChild = fitSplitToAxisSize(child, direction, childAxisSize, paneMinSize);
    changed ||= nextChild !== child;
    return nextChild;
  });

  return changed ? { ...split, children, sizes } : split;
}

function fitSizesToMinimums(sizes: number[], minSizes: number[], contentSize: number): number[] {
  const normalized = normalizeSplitSizes(sizes, sizes.length);
  if (contentSize <= 0) return normalized;
  if (normalized.every((size, index) => size * contentSize >= (minSizes[index] ?? 0))) return normalized;

  const out = Array.from({ length: normalized.length }, () => 0);
  const fixed = Array.from({ length: normalized.length }, () => false);
  let remainingSize = contentSize;
  let remainingWeight = normalized.reduce((sum, size) => sum + size, 0);
  const shareOf = (index: number) => remainingSize * (remainingWeight > 0 ? normalized[index]! / remainingWeight : 0);

  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < normalized.length; index += 1) {
      const minSize = minSizes[index] ?? 0;
      if (fixed[index] || shareOf(index) >= minSize) continue;
      out[index] = minSize;
      fixed[index] = true;
      remainingSize -= minSize;
      remainingWeight -= normalized[index]!;
      changed = true;
    }
  }

  for (let index = 0; index < normalized.length; index += 1) {
    if (!fixed[index]) out[index] = Math.max(0, shareOf(index));
  }

  const total = out.reduce((sum, size) => sum + size, 0);
  return total <= 0 ? normalized : out.map((size) => size / total);
}

function clampAdjacentPair(sizes: number[], minSizes: number[], index: number): number[] {
  const out = [...sizes];
  const pairTotal = out[index]! + out[index + 1]!;
  const leftMin = minSizes[index] ?? 0;
  const maxLeft = Math.max(leftMin, pairTotal - (minSizes[index + 1] ?? 0));
  out[index] = Math.min(Math.max(out[index]!, leftMin), maxLeft);
  out[index + 1] = pairTotal - out[index]!;
  return normalizeSplitSizes(out, out.length);
}
