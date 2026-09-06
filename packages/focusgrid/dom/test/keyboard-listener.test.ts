import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFocusGridController,
  type ComputedHandle,
  type FocusGridControllerState,
} from "@focusgrid/focusgrid/core";
import {
  normalizeKeyboardEvent,
  parseKeySequence,
} from "@focusgrid/shortcut-engine";
import { FocusGridDomController } from "../src/controller";
import { KeyboardListener } from "../src/keyboard-listener";
import { PointerResizeController } from "../src/pointer-resize";

function keyboardEvent(input: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: input.key ?? "",
    ctrlKey: input.ctrlKey ?? false,
    metaKey: input.metaKey ?? false,
    altKey: input.altKey ?? false,
    shiftKey: input.shiftKey ?? false,
  } as KeyboardEvent;
}

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

function keydownEvent(key: string, target: EventTarget | null = null): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
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

describe("normalizeKeyboardEvent", () => {
  it("keeps shift for alphabetic keys", () => {
    expect(
      normalizeKeyboardEvent(
        keyboardEvent({
          key: "B",
          shiftKey: true,
        }),
      ),
    ).toEqual({
      key: "b",
      ctrl: false,
      meta: false,
      alt: false,
      shift: true,
    });
  });

  it("drops shift for symbols already produced by shift", () => {
    expect(
      normalizeKeyboardEvent(
        keyboardEvent({
          key: "%",
          ctrlKey: true,
          shiftKey: true,
        }),
      ),
    ).toEqual({
      key: "%",
      ctrl: true,
      meta: false,
      alt: false,
      shift: false,
    });
  });

  it("converts shifted number keys to their produced symbol", () => {
    expect(
      normalizeKeyboardEvent(
        keyboardEvent({
          key: "5",
          ctrlKey: true,
          shiftKey: true,
        }),
      ),
    ).toEqual({
      key: "%",
      ctrl: true,
      meta: false,
      alt: false,
      shift: false,
    });
  });

  it("normalizes browser arrow key names to plain directions", () => {
    expect(
      normalizeKeyboardEvent(
        keyboardEvent({
          key: "ArrowRight",
        }),
      ),
    ).toEqual({
      key: "right",
      ctrl: false,
      meta: false,
      alt: false,
      shift: false,
    });
  });
});

describe("KeyboardListener command routing", () => {
  it.each([
    ["textarea", { tagName: "TEXTAREA" }, true],
    ["disabled textarea", { tagName: "TEXTAREA", disabled: true }, false],
    ["text input", { tagName: "INPUT", type: "text" }, true],
    ["readonly input", { tagName: "INPUT", type: "text", readOnly: true }, false],
    ["checkbox", { tagName: "INPUT", type: "checkbox" }, false],
    ["contenteditable", { tagName: "DIV", isContentEditable: true }, true],
    [
      "textbox role",
      { tagName: "DIV", getAttribute: (name: string) => name === "role" ? "TEXTBOX" : null },
      true,
    ],
  ] as const)("uses shared editable behavior for %s", (_, target, editable) => {
    const controller = createFocusGridController(controllerState());
    const run = vi.fn();
    controller.commands.register("editable", run);
    let onKey: ((event: KeyboardEvent) => void) | null = null;
    const root = {
      addEventListener: vi.fn((__, listener: EventListener) => {
        onKey = listener as (event: KeyboardEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    const listener = new KeyboardListener(controller, root, {
      keymap: [{
        sequence: parseKeySequence("E"),
        action: "editable",
        when: (context) => context.inputFocused,
      }],
    });

    listener.mount();
    onKey?.(keydownEvent("E", target as unknown as EventTarget));
    expect(run).toHaveBeenCalledTimes(editable ? 1 : 0);
    listener.destroy();
  });

  it("runs every keyboard resize through the current registry handler", () => {
    const controller = createFocusGridController(controllerState());
    const resize = vi.fn();
    controller.commands.register("pane.resizeRight", resize);
    let onKey: ((event: KeyboardEvent) => void) | null = null;
    const root = {
      addEventListener: vi.fn((_, listener: EventListener) => {
        onKey = listener as (event: KeyboardEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    const listener = new KeyboardListener(controller, root, {
      keymap: [
        {
          sequence: parseKeySequence("H"),
          action: "pane.resizeRight",
          args: { deltaPx: 10 },
        },
      ],
    });

    listener.mount();
    onKey?.(keydownEvent("H"));
    onKey?.(keydownEvent("H"));
    onKey?.(keydownEvent("H"));

    expect(resize).toHaveBeenCalledTimes(3);
    expect(resize.mock.calls.map((call) => call[1])).toEqual([
      { deltaPx: 10 },
      { deltaPx: 10 },
      { deltaPx: 10 },
    ]);

    listener.destroy();
  });

  it("does not run default keyboard resize commands blocked by the active pane axis", () => {
    const state = controllerState();
    if (state.root.kind !== "split") {
      throw new Error("expected split fixture");
    }
    state.root = {
      ...state.root,
      children: [
        {
          kind: "pane",
          id: "left-node",
          paneId: "left",
          canResizeX: false,
        },
        state.root.children[1]!,
      ],
    };
    const controller = createFocusGridController(state);
    const resize = vi.spyOn(controller.api, "resize");
    let onKey: ((event: KeyboardEvent) => void) | null = null;
    const root = {
      addEventListener: vi.fn((_, listener: EventListener) => {
        onKey = listener as (event: KeyboardEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    const listener = new KeyboardListener(controller, root, {
      keymap: [
        {
          sequence: parseKeySequence("H"),
          action: "pane.resizeRight",
          args: { deltaPx: 10 },
        },
      ],
    });

    listener.mount();
    onKey?.(keydownEvent("H"));
    onKey?.(keydownEvent("H"));

    expect(resize).not.toHaveBeenCalled();

    listener.destroy();
  });

  it("runs default keyboard resize commands on the unblocked axis", () => {
    const state = controllerState();
    if (state.root.kind !== "split") {
      throw new Error("expected split fixture");
    }
    state.root = {
      ...state.root,
      children: [
        {
          kind: "pane",
          id: "left-node",
          paneId: "left",
          canResizeY: false,
        },
        state.root.children[1]!,
      ],
    };
    const controller = createFocusGridController(state);
    const resize = vi.spyOn(controller.api, "resize");
    let onKey: ((event: KeyboardEvent) => void) | null = null;
    const root = {
      addEventListener: vi.fn((_, listener: EventListener) => {
        onKey = listener as (event: KeyboardEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    const listener = new KeyboardListener(controller, root, {
      keymap: [
        {
          sequence: parseKeySequence("H"),
          action: "pane.resizeRight",
          args: { deltaPx: 10 },
        },
      ],
    });

    listener.mount();
    onKey?.(keydownEvent("H"));

    expect(resize).toHaveBeenCalledWith("left", {
      direction: "right",
      deltaPx: 10,
    });

    listener.destroy();
  });

  it("runs non-resize commands immediately", () => {
    const controller = createFocusGridController(controllerState());
    const run = vi.spyOn(controller.commands, "run");
    let onKey: ((event: KeyboardEvent) => void) | null = null;
    const root = {
      addEventListener: vi.fn((_, listener: EventListener) => {
        onKey = listener as (event: KeyboardEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    const listener = new KeyboardListener(controller, root, {
      keymap: [
        {
          sequence: parseKeySequence("X"),
          action: "pane.close",
        },
      ],
    });

    listener.mount();
    onKey?.(keydownEvent("X"));

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("pane.close", controller, undefined);

    listener.destroy();
  });
});

describe("FocusGridDomController lifecycle", () => {
  it("mounts and destroys keyboard and resize observers idempotently", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const ResizeObserverMock = vi.fn().mockImplementation(() => ({
      observe,
      disconnect,
    })) as unknown as typeof ResizeObserver;
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const controller = createFocusGridController(controllerState());
    const root = {
      tabIndex: -1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        width: 1000,
        height: 600,
      })),
    } as unknown as HTMLElement;
    const domController = new FocusGridDomController(controller, root, {
      keymap: [],
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

describe("PointerResizeController batching", () => {
  it("does not enter drag state for a missing split", () => {
    const controller = createFocusGridController(controllerState());
    const resize = vi.spyOn(controller.api, "resizeHandle");
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

    const controller = createFocusGridController(controllerState());
    const resize = vi.spyOn(controller.api, "resizeHandle");
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

    const controller = createFocusGridController(controllerState());
    const resize = vi.spyOn(controller.api, "resizeHandle");
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
    const controller = createFocusGridController(controllerState());
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

    const controller = createFocusGridController(controllerState());
    const resize = vi.spyOn(controller.api, "resizeHandle");
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

    const controller = createFocusGridController(controllerState());
    const resize = vi.spyOn(controller.api, "resizeHandle");
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

    const controller = createFocusGridController(controllerState());
    const resize = vi.spyOn(controller.api, "resizeHandle");
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

    const controller = createFocusGridController(controllerState());
    const resize = vi.spyOn(controller.api, "resizeHandle");
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
