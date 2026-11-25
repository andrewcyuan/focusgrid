import { afterEach, describe, expect, it, vi } from "vitest";
import { FocusGridController, type ComputedHandle, type FocusGridControllerState } from "@andrewcyuan/focusgrid/core";
import { PointerResizeController } from "../src/pointer-resize";

function controllerState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        {
          kind: "pane",
          id: "left-node",
          paneId: "left",
        },
        {
          kind: "pane",
          id: "right-node",
          paneId: "right",
        },
      ],
    },
    activePaneId: "left",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

function pointerEvent(input: { pointerId: number; clientX: number; clientY?: number }): PointerEvent {
  return {
    pointerId: input.pointerId,
    clientX: input.clientX,
    clientY: input.clientY ?? 0,
    preventDefault: vi.fn(),
  } as unknown as PointerEvent;
}

function resizeHandle(): ComputedHandle {
  return {
    id: "root:0",
    splitId: "root",
    index: 0,
    direction: "horizontal",
    rect: {
      x: 497,
      y: 0,
      width: 6,
      height: 600,
    },
  };
}

type PointerListener = (event: PointerEvent) => void;

function setup(target: Partial<Element> = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() }) {
  const listeners = new Map<string, PointerListener>();
  const ownerDocument = {
    addEventListener: vi.fn((type: string, listener: PointerListener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string, listener: PointerListener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    }),
  };
  const captureTarget = { ...target, ownerDocument } as unknown as Element;
  const controller = new FocusGridController(controllerState(), { focus: () => true });
  const resize = vi.spyOn(controller, "resizeHandle");
  const resizeController = new PointerResizeController(controller);
  const start = (handle = resizeHandle()) =>
    resizeController.startResize(pointerEvent({ pointerId: 1, clientX: 100 }), handle, captureTarget);
  return { controller, resize, resizeController, ownerDocument, listeners, captureTarget, start };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PointerResizeController batching", () => {
  it("does not enter drag state for a missing split", () => {
    const { resize, resizeController, ownerDocument, start } = setup();

    start({ ...resizeHandle(), splitId: "missing" });
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 150 }));
    resizeController.endResize(pointerEvent({ pointerId: 1, clientX: 150 }));

    expect(resize).not.toHaveBeenCalled();
    expect(ownerDocument.addEventListener).not.toHaveBeenCalled();
  });

  it("coalesces pointer moves using the latest absolute drag delta", () => {
    vi.useFakeTimers();
    const { resize, resizeController, start } = setup();

    start();
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 110 }));
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 130 }));
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 160 }));

    expect(resize).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resize).toHaveBeenCalledWith("root", { index: 0, deltaPx: 60, snapshotSizes: [0.5, 0.5] });
  });

  it("flushes the latest pending resize when the drag ends before the frame runs", () => {
    vi.useFakeTimers();
    const { resize, resizeController, start } = setup();

    start();
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 145 }));
    resizeController.endResize(pointerEvent({ pointerId: 1, clientX: 145 }));

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resize).toHaveBeenCalledWith("root", { index: 0, deltaPx: 45, snapshotSizes: [0.5, 0.5] });

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
  });

  it("continues resizing from document pointer moves after leaving the handle", () => {
    vi.useFakeTimers();
    const { resize, ownerDocument, listeners, start } = setup();

    start();

    expect(ownerDocument.addEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(ownerDocument.addEventListener).toHaveBeenCalledWith("pointerup", expect.any(Function));
    expect(ownerDocument.addEventListener).toHaveBeenCalledWith("pointercancel", expect.any(Function));

    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 150 }));

    expect(resize).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resize).toHaveBeenCalledWith("root", { index: 0, deltaPx: 50, snapshotSizes: [0.5, 0.5] });
  });

  it("flushes pending resize, removes listeners, and releases capture on pointer up", () => {
    vi.useFakeTimers();
    const { resize, ownerDocument, listeners, captureTarget, start } = setup();

    start();
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 140 }));
    listeners.get("pointerup")?.(pointerEvent({ pointerId: 1, clientX: 140 }));

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resize).toHaveBeenCalledWith("root", { index: 0, deltaPx: 40, snapshotSizes: [0.5, 0.5] });
    expect(ownerDocument.removeEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(ownerDocument.removeEventListener).toHaveBeenCalledWith("pointerup", expect.any(Function));
    expect(ownerDocument.removeEventListener).toHaveBeenCalledWith("pointercancel", expect.any(Function));
    expect(captureTarget.setPointerCapture).toHaveBeenCalledWith(1);
    expect(captureTarget.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(listeners.size).toBe(0);

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
  });

  it("cleans up pointer cancel without leaving a pending frame", () => {
    vi.useFakeTimers();
    const { resize, ownerDocument, listeners, captureTarget, start } = setup();

    start();
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 125 }));
    listeners.get("pointercancel")?.(pointerEvent({ pointerId: 1, clientX: 125 }));

    expect(resize).toHaveBeenCalledTimes(1);
    expect(ownerDocument.removeEventListener).toHaveBeenCalledTimes(3);
    expect(captureTarget.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(listeners.size).toBe(0);

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
  });

  it("keeps document listeners active when pointer capture is unavailable", () => {
    vi.useFakeTimers();
    const { resize, listeners, start } = setup({});

    start();
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 135 }));
    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledWith("root", { index: 0, deltaPx: 35, snapshotSizes: [0.5, 0.5] });

    listeners.get("pointerup")?.(pointerEvent({ pointerId: 1, clientX: 135 }));

    expect(listeners.size).toBe(0);
  });

  it("uses the original ratios across multiple animation frames", () => {
    vi.useFakeTimers();
    const { controller, resizeController, start } = setup();
    const changes: number[][] = [];
    controller.subscribe((next) => {
      if (next.root.kind === "split") changes.push(next.root.sizes);
    });

    start();
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 150 }));
    vi.runOnlyPendingTimers();
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 200 }));
    vi.runOnlyPendingTimers();
    resizeController.endResize(pointerEvent({ pointerId: 1, clientX: 200 }));

    expect(changes).toHaveLength(2);
    expect(changes[0][0]).toBeCloseTo(0.55);
    expect(changes[1][0]).toBeCloseTo(0.6);
  });

  it("ignores a removed split when a queued resize runs and still releases capture", () => {
    vi.useFakeTimers();
    const { controller, resizeController, listeners, captureTarget, start } = setup();

    start();
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 150 }));
    controller.remove("right");
    const listener = vi.fn();
    controller.subscribe(listener);
    vi.runOnlyPendingTimers();
    resizeController.endResize(pointerEvent({ pointerId: 1, clientX: 150 }));

    expect(listener).not.toHaveBeenCalled();
    expect(captureTarget.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(listeners.size).toBe(0);
  });
});
