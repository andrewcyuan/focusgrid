import type { PaneFocusDirection, Rect } from "./types";

export function isHorizontalDirection(direction: PaneFocusDirection): boolean {
  return direction === "left" || direction === "right";
}

export function isRectInDirection(
  rect: Rect,
  activeRect: Rect,
  direction: PaneFocusDirection,
): boolean {
  const epsilon = 0.001;
  if (direction === "right") return rect.x >= activeRect.x + activeRect.width - epsilon;
  if (direction === "left") return rect.x + rect.width <= activeRect.x + epsilon;
  if (direction === "down") return rect.y >= activeRect.y + activeRect.height - epsilon;
  return rect.y + rect.height <= activeRect.y + epsilon;
}

export function getEnteringEdge(rect: Rect, direction: PaneFocusDirection): number {
  if (direction === "right") return rect.x;
  if (direction === "left") return rect.x + rect.width;
  if (direction === "down") return rect.y;
  return rect.y + rect.height;
}

export function compareEnteringEdge(
  first: number,
  second: number,
  direction: PaneFocusDirection,
): number {
  return direction === "left" || direction === "up"
    ? second - first
    : first - second;
}

export function getPerpendicularCenter(
  rect: Rect,
  direction: PaneFocusDirection,
): number {
  const center = getRectCenter(rect);
  return isHorizontalDirection(direction) ? center.y : center.x;
}

export function getRectCenter(rect: Rect): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function getCenterDistance(
  rect: Rect,
  center: { x: number; y: number },
): number {
  const rectCenter = getRectCenter(rect);
  return Math.abs(rectCenter.x - center.x) + Math.abs(rectCenter.y - center.y);
}
