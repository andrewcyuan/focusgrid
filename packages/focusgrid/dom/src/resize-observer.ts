import type { FocusGridController } from "@andrewcyuan/focusgrid/core";

export function observeRootSize(root: HTMLElement, controller: FocusGridController): () => void {
  const updateSize = ({ width, height }: { width: number; height: number }) => {
    controller.setContainerSize(Math.floor(width), Math.floor(height));
  };
  if (typeof ResizeObserver === "undefined") {
    updateSize(root.getBoundingClientRect());
    return () => {};
  }
  const observer = new ResizeObserver(([entry]) => {
    if (entry) updateSize(entry.contentRect);
  });
  observer.observe(root);
  return () => observer.disconnect();
}
