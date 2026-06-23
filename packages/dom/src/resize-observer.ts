import type { Workspace } from "@focusgrid/core";

export class RootResizeObserver {
  private resizeObserver?: ResizeObserver;

  constructor(
    private readonly workspace: Workspace,
    private readonly rootEl: HTMLElement,
  ) {}

  mount(): void {
    if (typeof ResizeObserver === "undefined") {
      const rect = this.rootEl.getBoundingClientRect();
      this.dispatchSize(rect.width, rect.height);
      return;
    }

    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      this.dispatchSize(entry.contentRect.width, entry.contentRect.height);
    });

    this.resizeObserver.observe(this.rootEl);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  private dispatchSize(width: number, height: number): void {
    this.workspace.dispatch({
      type: "container.setSize",
      width: Math.floor(width),
      height: Math.floor(height),
    });
  }
}
