import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FocusGridController,
  type ComputedHandle,
  type FocusGridControllerState,
} from "@andrewcyuan/focusgrid/core";
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

function pointerEvent(input: {
  pointerId: number;
  clientX: number;
  clientY?: number;
}): PointerEvent {
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

function pointerDocument() {
  const listeners = new Map<string, PointerListener>();
  const ownerDocument = {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, listener as PointerListener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      if (listeners.get(type) === listener) {
        listeners.delete(type);
      }
    }),
  } as unknown as Document;

  return { ownerDocument, listeners };
}

function captureTarget(ownerDocument: Document) {
  return {
    ownerDocument,
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
    releasePointerCapture: vi.fn(),
  } as unknown as Element & {
    setPointerCapture: ReturnType<typeof vi.fn>;
    hasPointerCapture: ReturnType<typeof vi.fn>;
    releasePointerCapture: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => {
  vi.stubGlobal("HTMLElement", class HTMLElement {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PointerResizeController batching", () => {
  it("does not enter drag state for a missing split", () => {
    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const resize = vi.spyOn(controller, "resizeHandle");
    const resizeController = new PointerResizeController(controller);
    const missing = { ...resizeHandle(), splitId: "missing" };

    resizeController.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      missing,
    );
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 150 }));
    resizeController.endResize(pointerEvent({ pointerId: 1, clientX: 150 }));

    expect(resize).not.toHaveBeenCalled();
  });

  it("coalesces pointer moves using the latest absolute drag delta", () => {
    vi.useFakeTimers();

    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const resize = vi.spyOn(controller, "resizeHandle");
    const resizeController = new PointerResizeController(controller);
    const handle = resizeHandle();

    resizeController.startResize(pointerEvent({ pointerId: 1, clientX: 100 }), handle);
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 110 }));
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 130 }));
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 160 }));

    expect(resize).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resize).toHaveBeenCalledWith("root", {
      index: 0,
      deltaPx: 60,
      snapshotSizes: [0.5, 0.5],
    });
  });

  it("flushes the latest pending resize when the drag ends before the frame runs", () => {
    vi.useFakeTimers();

    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const resize = vi.spyOn(controller, "resizeHandle");
    const resizeController = new PointerResizeController(controller);
    const handle = resizeHandle();

    resizeController.startResize(pointerEvent({ pointerId: 1, clientX: 100 }), handle);
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 145 }));
    resizeController.endResize(pointerEvent({ pointerId: 1, clientX: 145 }));

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resize).toHaveBeenCalledWith("root", {
      index: 0,
      deltaPx: 45,
      snapshotSizes: [0.5, 0.5],
    });

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
  });

  it("registers document-level drag listeners when a drag starts", () => {
    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const resizeController = new PointerResizeController(controller);
    const { ownerDocument } = pointerDocument();
    const target = captureTarget(ownerDocument);

    resizeController.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      resizeHandle(),
      target,
    );

    expect(ownerDocument.addEventListener).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function),
    );
    expect(ownerDocument.addEventListener).toHaveBeenCalledWith(
      "pointerup",
      expect.any(Function),
    );
    expect(ownerDocument.addEventListener).toHaveBeenCalledWith(
      "pointercancel",
      expect.any(Function),
    );
  });

  it("continues resizing from document pointer moves after leaving the handle", () => {
    vi.useFakeTimers();

    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const resize = vi.spyOn(controller, "resizeHandle");
    const resizeController = new PointerResizeController(controller);
    const { ownerDocument, listeners } = pointerDocument();
    const target = captureTarget(ownerDocument);

    resizeController.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      resizeHandle(),
      target,
    );
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 150 }));

    expect(resize).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resize).toHaveBeenCalledWith("root", {
      index: 0,
      deltaPx: 50,
      snapshotSizes: [0.5, 0.5],
    });
  });

  it("flushes pending resize, removes listeners, and releases capture on pointer up", () => {
    vi.useFakeTimers();

    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const resize = vi.spyOn(controller, "resizeHandle");
    const resizeController = new PointerResizeController(controller);
    const { ownerDocument, listeners } = pointerDocument();
    const target = captureTarget(ownerDocument);

    resizeController.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      resizeHandle(),
      target,
    );
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 140 }));
    listeners.get("pointerup")?.(pointerEvent({ pointerId: 1, clientX: 140 }));

    expect(resize).toHaveBeenCalledTimes(1);
    expect(resize).toHaveBeenCalledWith("root", {
      index: 0,
      deltaPx: 40,
      snapshotSizes: [0.5, 0.5],
    });
    expect(ownerDocument.removeEventListener).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function),
    );
    expect(ownerDocument.removeEventListener).toHaveBeenCalledWith(
      "pointerup",
      expect.any(Function),
    );
    expect(ownerDocument.removeEventListener).toHaveBeenCalledWith(
      "pointercancel",
      expect.any(Function),
    );
    expect(target.setPointerCapture).toHaveBeenCalledWith(1);
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(listeners.size).toBe(0);

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
  });

  it("cleans up pointer cancel without leaving a pending frame", () => {
    vi.useFakeTimers();

    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const resize = vi.spyOn(controller, "resizeHandle");
    const resizeController = new PointerResizeController(controller);
    const { ownerDocument, listeners } = pointerDocument();
    const target = captureTarget(ownerDocument);

    resizeController.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      resizeHandle(),
      target,
    );
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 125 }));
    listeners.get("pointercancel")?.(pointerEvent({ pointerId: 1, clientX: 125 }));

    expect(resize).toHaveBeenCalledTimes(1);
    expect(ownerDocument.removeEventListener).toHaveBeenCalledTimes(3);
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(listeners.size).toBe(0);

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledTimes(1);
  });

  it("keeps document listeners active when pointer capture is unavailable", () => {
    vi.useFakeTimers();

    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const resize = vi.spyOn(controller, "resizeHandle");
    const resizeController = new PointerResizeController(controller);
    const { ownerDocument, listeners } = pointerDocument();
    const target = { ownerDocument } as Element;

    resizeController.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      resizeHandle(),
      target,
    );
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 135 }));

    vi.runOnlyPendingTimers();

    expect(resize).toHaveBeenCalledWith("root", {
      index: 0,
      deltaPx: 35,
      snapshotSizes: [0.5, 0.5],
    });
  });

  it("uses the original ratios across multiple animation frames", () => {
    vi.useFakeTimers();
    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const changes: number[][] = [];
    controller.subscribe(next => {
      if (next.root.kind === "split") changes.push(next.root.sizes);
    });
    const resizeController = new PointerResizeController(controller);
    resizeController.startResize(pointerEvent({ pointerId: 1, clientX: 100 }), resizeHandle());
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
    const controller = new FocusGridController(controllerState(), { focus: () => true });
    const resizeController = new PointerResizeController(controller);
    const { ownerDocument, listeners } = pointerDocument();
    const target = captureTarget(ownerDocument);
    resizeController.startResize(pointerEvent({ pointerId: 1, clientX: 100 }), resizeHandle(), target);
    resizeController.updateResize(pointerEvent({ pointerId: 1, clientX: 150 }));
    controller.remove("right");
    const listener = vi.fn();
    controller.subscribe(listener);
    vi.runOnlyPendingTimers();
    resizeController.endResize(pointerEvent({ pointerId: 1, clientX: 150 }));
    expect(listener).not.toHaveBeenCalled();
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(listeners.size).toBe(0);
  });

});
