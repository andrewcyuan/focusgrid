import { afterEach, describe, expect, it, vi } from "vitest";
import { FocusGridController } from "@andrewcyuan/focusgrid/core";
import { observeRootSize } from "../src/resize-observer";

function controller() {
  return new FocusGridController({
    root: { kind: "pane", id: "node", paneId: "pane" }, activePaneId: "pane", container: { width: 0, height: 0 },
  }, { focus: () => true });
}
afterEach(() => vi.unstubAllGlobals());

describe("root resize observation", () => {
  it("updates dimensions and releases the native observer", () => {
    let notify: ResizeObserverCallback;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { notify = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    const root = {} as HTMLElement;
    const grid = controller();
    const listener = vi.fn();
    grid.subscribe(listener);
    const cleanup = observeRootSize(root, grid);
    expect(observe).toHaveBeenCalledWith(root);
    notify!([{ contentRect: { width: 801.9, height: 402.1 } } as ResizeObserverEntry], {} as ResizeObserver);
    expect(listener.mock.calls[0][0].container).toEqual({ width: 801, height: 402 });
    cleanup();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("measures once when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const root = { getBoundingClientRect: () => ({ width: 320.8, height: 200.9 }) } as HTMLElement;
    const grid = controller();
    const cleanup = observeRootSize(root, grid);
    expect(grid.getContainerSize()).toEqual({ width: 320, height: 200 });
    cleanup();
  });
});
