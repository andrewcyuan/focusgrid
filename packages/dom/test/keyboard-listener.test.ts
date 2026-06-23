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

function eventTarget(): HTMLElement {
  return {} as HTMLElement;
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
    currentTarget: eventTarget(),
    preventDefault: vi.fn(),
  } as unknown as PointerEvent;
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
    const handle: ComputedHandle = {
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
});
