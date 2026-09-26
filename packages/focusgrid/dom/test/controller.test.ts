import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FocusGridController,
  type ComputedHandle,
  type FocusGridControllerState,
} from "@andrewcyuan/focusgrid/core";
import {
  createShortcutEngine,
} from "@andrewcyuan/shortcut-engine";
import { FocusGridDomController } from "../src/controller";
import { PointerResizeController } from "../src/pointer-resize";

function controllerState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      direction: "horizontal",
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

describe("FocusGridDomController lifecycle", () => {
  it("mounts and destroys keyboard and resize observers idempotently", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const ResizeObserverMock = vi.fn().mockImplementation(function () {
      return { observe, disconnect };
    }) as unknown as typeof ResizeObserver;
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const controller = new FocusGridController(controllerState());
    const root = {
      tabIndex: -1,
      getAttribute: () => null,
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        width: 1000,
        height: 600,
      })),
    } as unknown as HTMLElement;
    const domController = new FocusGridDomController(controller, root, {
      keymap: [],
      engine: createShortcutEngine(),
      scopeId: "grid",
      parentScopeId: null,
    });

    domController.mount();
    domController.mount();

    expect(root.tabIndex).toBe(0);
    expect(root.addEventListener).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(root);

    domController.destroy();
    domController.destroy();

    expect(root.removeEventListener).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("shared engine grid boundaries", () => {
  function root() {
    return {
      tabIndex: -1,
      getAttribute: () => null,
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: () => ({ width: 1000, height: 600 }),
    } as unknown as HTMLElement;
  }

  it("does not reset another grid's pending sequence when inactive pane state changes", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const engine = createShortcutEngine();
    const active = new FocusGridController(controllerState());
    const inactive = new FocusGridController(controllerState());
    const action = vi.fn();
    const first = new FocusGridDomController(active, root(), {
      engine, scopeId: "active", parentScopeId: null,
      keymap: [{ sequence: "G G", action }],
    });
    const second = new FocusGridDomController(inactive, root(), {
      engine, scopeId: "inactive", parentScopeId: null,
    });
    first.mount(); second.mount();
    engine.setActiveScope("active");
    const key = () => ({ key: "g", preventDefault() {}, stopPropagation() {} }) as KeyboardEvent;
    engine.handle(key());
    inactive.focus("right");
    engine.handle(key());
    expect(action).toHaveBeenCalledOnce();
    engine.handle(key());
    active.focus("right");
    expect(engine.handle(key())).toBe("pending");
    expect(action).toHaveBeenCalledOnce();
    first.destroy(); second.destroy();
  });

  it("keeps updated bindings across native mount cycles", () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const engine = createShortcutEngine(), action = vi.fn();
    const dom = new FocusGridDomController(new FocusGridController(controllerState()), root(), {
      engine, scopeId: "grid", parentScopeId: null,
    });
    dom.mount();
    dom.setKeymap([{ sequence: "K", action }]);
    dom.destroy(); dom.mount();
    engine.setActiveScope("grid");
    engine.handle({ key: "k", preventDefault() {}, stopPropagation() {} } as KeyboardEvent);
    expect(action).toHaveBeenCalledOnce();
    dom.destroy();
  });
});

describe("PointerResizeController batching", () => {
  it("does not enter drag state for a missing split", () => {
    const controller = new FocusGridController(controllerState());
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

    const controller = new FocusGridController(controllerState());
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

    const controller = new FocusGridController(controllerState());
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
    const controller = new FocusGridController(controllerState());
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

    const controller = new FocusGridController(controllerState());
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

    const controller = new FocusGridController(controllerState());
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

    const controller = new FocusGridController(controllerState());
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

    const controller = new FocusGridController(controllerState());
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
});
