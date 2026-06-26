import { describe, expect, it, vi } from "vitest";
import {
  createDefaultKCLKeymap,
  createKCLController,
  type KCLActionBinding,
} from "@focusgrid/kcl";
import { KCLDomController } from "../src";

type Listener = (event: KeyboardEvent) => void;

function rootElement() {
  const listeners = new Map<string, Listener>();
  const attributes = new Map<string, string>();
  const ownerDocument = {
    activeElement: null as unknown,
  };
  const root = {
    id: "todos",
    tabIndex: -1,
    ownerDocument,
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners.set(type, listener);
    }),
    removeEventListener: vi.fn(),
    setAttribute: vi.fn((name: string, value: string) => {
      attributes.set(name, value);
    }),
    removeAttribute: vi.fn((name: string) => {
      attributes.delete(name);
    }),
    focus: vi.fn(() => {
      ownerDocument.activeElement = root;
    }),
  } as unknown as HTMLElement & {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    setAttribute: ReturnType<typeof vi.fn>;
    removeAttribute: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
  };

  return { root, listeners, attributes, ownerDocument };
}

function keydownEvent(input: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: input.key ?? "",
    ctrlKey: input.ctrlKey ?? false,
    metaKey: input.metaKey ?? false,
    altKey: input.altKey ?? false,
    shiftKey: input.shiftKey ?? false,
    target: input.target ?? null,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe("KCLDomController", () => {
  it("mounts focusable listbox ARIA and keeps activedescendant in sync", () => {
    const controller = createKCLController({ itemCount: 3, activeIndex: 1 });
    const { root, attributes } = rootElement();
    const domController = new KCLDomController(controller, root);

    domController.mount();

    expect(root.tabIndex).toBe(0);
    expect(attributes.get("role")).toBe("listbox");
    expect(attributes.get("aria-orientation")).toBe("vertical");
    expect(attributes.get("aria-activedescendant")).toBe("todos-row-1");

    controller.api.setActiveIndex(2);
    expect(attributes.get("aria-activedescendant")).toBe("todos-row-2");

    controller.api.setItemCount(0);
    expect(attributes.has("aria-activedescendant")).toBe(false);
  });

  it("registers keyboard handling in capture phase and ignores modifier-only keys", () => {
    const controller = createKCLController({ itemCount: 2 });
    const { root, listeners } = rootElement();
    const domController = new KCLDomController(controller, root, {
      keymap: createDefaultKCLKeymap(),
    });

    domController.mount();

    expect(root.addEventListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
      { capture: true },
    );

    const shift = keydownEvent({ key: "Shift", shiftKey: true });
    listeners.get("keydown")?.(shift);

    expect(shift.preventDefault).not.toHaveBeenCalled();
    expect(controller.getState().activeIndex).toBe(0);
  });

  it("runs movement commands and prevents matched keyboard events", () => {
    const controller = createKCLController({ itemCount: 3 });
    const { root, listeners } = rootElement();
    const domController = new KCLDomController(controller, root, {
      keymap: createDefaultKCLKeymap(),
    });
    const event = keydownEvent({ key: "ArrowDown" });

    domController.mount();
    listeners.get("keydown")?.(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(controller.getState().activeIndex).toBe(1);
  });

  it("ignores keyboard routing from editable descendants", () => {
    const action = vi.fn();
    const controller = createKCLController({ itemCount: 2 });
    const { root, listeners } = rootElement();
    const domController = new KCLDomController(controller, root, {
      keymap: createDefaultKCLKeymap({ onActivate: action }),
    });
    const input = {
      tagName: "INPUT",
      getAttribute: () => null,
    };
    const event = keydownEvent({
      key: " ",
      target: input as unknown as EventTarget,
    });

    domController.mount();
    listeners.get("keydown")?.(event);

    expect(action).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(controller.getState().activeIndex).toBe(0);
  });

  it("consumes pending prefixes and invalid continuations", () => {
    const controller = createKCLController({ itemCount: 1 });
    const keymap: KCLActionBinding<string>[] = [
      {
        sequence: "Ctrl-B Enter",
        action: "activate",
      },
    ];
    const { root, listeners } = rootElement();
    const domController = new KCLDomController(controller, root, { keymap });

    domController.mount();

    const prefix = keydownEvent({ key: "b", ctrlKey: true });
    listeners.get("keydown")?.(prefix);
    expect(prefix.preventDefault).toHaveBeenCalledTimes(1);

    const invalid = keydownEvent({ key: "z" });
    listeners.get("keydown")?.(invalid);
    expect(invalid.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("runs cell actions with current active row data", () => {
    const action = vi.fn();
    const controller = createKCLController({ itemCount: 2, activeIndex: 1 });
    const { root, listeners } = rootElement();
    const domController = new KCLDomController(controller, root, {
      dataList: ["alpha", "beta"],
      keymap: [
        {
          sequence: "Enter",
          action,
        },
      ],
    });

    domController.mount();
    listeners.get("keydown")?.(keydownEvent({ key: "Enter" }));

    expect(action).toHaveBeenCalledWith({
      index: 1,
      data: "beta",
      isListFocused: false,
      isCellActive: true,
    });
  });

  it("focuses the root and updates active index from row pointer props", () => {
    const edit = vi.fn();
    const controller = createKCLController({ itemCount: 2 });
    const { root } = rootElement();
    const domController = new KCLDomController(controller, root, {
      dataList: ["alpha", "beta"],
      keymap: createDefaultKCLKeymap({ onEdit: edit }),
    });

    domController.mount();
    const row = domController.getRowProps(1);
    const pointer = { preventDefault: vi.fn(), target: root };
    const click = { target: root };

    row.onPointerDown(pointer);
    row.onClick(click);

    expect(pointer.preventDefault).toHaveBeenCalledTimes(1);
    expect(root.focus).toHaveBeenCalledTimes(1);
    expect(controller.getState().activeIndex).toBe(1);

    row.onDoubleClick(click);
    expect(edit).toHaveBeenCalledWith({
      index: 1,
      data: "beta",
      isListFocused: false,
      isCellActive: true,
    });
  });
});
