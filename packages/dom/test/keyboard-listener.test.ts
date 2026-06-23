import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWorkspace,
  parseKeySequence,
  type ComputedHandle,
  type WorkspaceState,
} from "@focusgrid/core";
import { KeyboardListener, normalizeKeyboardEvent } from "../src/keyboard-listener";
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

function workspaceState(): WorkspaceState {
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

function keydownEvent(key: string): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: null,
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

describe("KeyboardListener resize batching", () => {
  it("coalesces same-frame keyboard resize commands", () => {
    vi.useFakeTimers();

    const workspace = createWorkspace(workspaceState());
    const dispatch = vi.spyOn(workspace, "dispatch");
    let onKey: ((event: KeyboardEvent) => void) | null = null;
    const root = {
      addEventListener: vi.fn((_, listener: EventListener) => {
        onKey = listener as (event: KeyboardEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    const listener = new KeyboardListener(workspace, root, {
      keymap: [
        {
          sequence: parseKeySequence("H"),
          command: "pane.resizeRight",
          args: { deltaPx: 10 },
        },
      ],
    });

    listener.mount();
    onKey?.(keydownEvent("H"));
    onKey?.(keydownEvent("H"));
    onKey?.(keydownEvent("H"));

    expect(dispatch).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "pane.resize",
      paneId: "left",
      direction: "right",
      deltaPx: 30,
    });

    listener.destroy();
  });

  it("runs non-resize commands immediately", () => {
    vi.useFakeTimers();

    const workspace = createWorkspace(workspaceState());
    const run = vi.spyOn(workspace.commands, "run");
    let onKey: ((event: KeyboardEvent) => void) | null = null;
    const root = {
      addEventListener: vi.fn((_, listener: EventListener) => {
        onKey = listener as (event: KeyboardEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as HTMLElement;
    const listener = new KeyboardListener(workspace, root, {
      keymap: [
        {
          sequence: parseKeySequence("X"),
          command: "pane.close",
        },
      ],
    });

    listener.mount();
    onKey?.(keydownEvent("X"));

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("pane.close", workspace, undefined);

    listener.destroy();
  });
});

describe("PointerResizeController batching", () => {
  it("coalesces pointer moves using the latest absolute drag delta", () => {
    vi.useFakeTimers();

    const workspace = createWorkspace(workspaceState());
    const dispatch = vi.spyOn(workspace, "dispatch");
    const controller = new PointerResizeController(workspace);
    const handle = resizeHandle();

    controller.startResize(pointerEvent({ pointerId: 1, clientX: 100 }), handle);
    controller.updateResize(pointerEvent({ pointerId: 1, clientX: 110 }));
    controller.updateResize(pointerEvent({ pointerId: 1, clientX: 130 }));
    controller.updateResize(pointerEvent({ pointerId: 1, clientX: 160 }));

    expect(dispatch).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "handle.resize",
      splitId: "root",
      index: 0,
      deltaPx: 60,
      snapshotSizes: [0.5, 0.5],
    });
  });

  it("flushes the latest pending resize when the drag ends before the frame runs", () => {
    vi.useFakeTimers();

    const workspace = createWorkspace(workspaceState());
    const dispatch = vi.spyOn(workspace, "dispatch");
    const controller = new PointerResizeController(workspace);
    const handle = resizeHandle();

    controller.startResize(pointerEvent({ pointerId: 1, clientX: 100 }), handle);
    controller.updateResize(pointerEvent({ pointerId: 1, clientX: 145 }));
    controller.endResize(pointerEvent({ pointerId: 1, clientX: 145 }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "handle.resize",
      splitId: "root",
      index: 0,
      deltaPx: 45,
      snapshotSizes: [0.5, 0.5],
    });

    vi.runOnlyPendingTimers();

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("registers document-level drag listeners when a drag starts", () => {
    const workspace = createWorkspace(workspaceState());
    const controller = new PointerResizeController(workspace);
    const { ownerDocument } = pointerDocument();
    const target = captureTarget(ownerDocument);

    controller.startResize(
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

    const workspace = createWorkspace(workspaceState());
    const dispatch = vi.spyOn(workspace, "dispatch");
    const controller = new PointerResizeController(workspace);
    const { ownerDocument, listeners } = pointerDocument();
    const target = captureTarget(ownerDocument);

    controller.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      resizeHandle(),
      target,
    );
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 150 }));

    expect(dispatch).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "handle.resize",
      splitId: "root",
      index: 0,
      deltaPx: 50,
      snapshotSizes: [0.5, 0.5],
    });
  });

  it("flushes pending resize, removes listeners, and releases capture on pointer up", () => {
    vi.useFakeTimers();

    const workspace = createWorkspace(workspaceState());
    const dispatch = vi.spyOn(workspace, "dispatch");
    const controller = new PointerResizeController(workspace);
    const { ownerDocument, listeners } = pointerDocument();
    const target = captureTarget(ownerDocument);

    controller.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      resizeHandle(),
      target,
    );
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 140 }));
    listeners.get("pointerup")?.(pointerEvent({ pointerId: 1, clientX: 140 }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "handle.resize",
      splitId: "root",
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

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("cleans up pointer cancel without leaving a pending frame", () => {
    vi.useFakeTimers();

    const workspace = createWorkspace(workspaceState());
    const dispatch = vi.spyOn(workspace, "dispatch");
    const controller = new PointerResizeController(workspace);
    const { ownerDocument, listeners } = pointerDocument();
    const target = captureTarget(ownerDocument);

    controller.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      resizeHandle(),
      target,
    );
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 125 }));
    listeners.get("pointercancel")?.(pointerEvent({ pointerId: 1, clientX: 125 }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(ownerDocument.removeEventListener).toHaveBeenCalledTimes(3);
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(listeners.size).toBe(0);

    vi.runOnlyPendingTimers();

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("keeps document listeners active when pointer capture is unavailable", () => {
    vi.useFakeTimers();

    const workspace = createWorkspace(workspaceState());
    const dispatch = vi.spyOn(workspace, "dispatch");
    const controller = new PointerResizeController(workspace);
    const { ownerDocument, listeners } = pointerDocument();
    const target = { ownerDocument } as Element;

    controller.startResize(
      pointerEvent({ pointerId: 1, clientX: 100 }),
      resizeHandle(),
      target,
    );
    listeners.get("pointermove")?.(pointerEvent({ pointerId: 1, clientX: 135 }));

    vi.runOnlyPendingTimers();

    expect(dispatch).toHaveBeenCalledWith({
      type: "handle.resize",
      splitId: "root",
      index: 0,
      deltaPx: 35,
      snapshotSizes: [0.5, 0.5],
    });
  });
});
