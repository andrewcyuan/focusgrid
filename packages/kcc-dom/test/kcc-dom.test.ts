import { describe, expect, it, vi } from "vitest";
import {
  createDefaultKCCollectionKeymap,
  createKCController,
  type KCActionBinding,
  type KCRegisteredEntry,
} from "@focusgrid/kcc-core";
import { KCDomController } from "../src";

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

function entries(
  keybinds: readonly KCActionBinding<unknown>[] = []
): readonly KCRegisteredEntry[] {
  return [
    {
      id: "alpha",
      element: null,
      data: "alpha",
      getActionKeybinds: () => keybinds,
    },
    {
      id: "beta",
      element: null,
      data: "beta",
      getActionKeybinds: () => keybinds,
    },
  ];
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

describe("KCDomController", () => {
  it("mounts focusable listbox ARIA and keeps activedescendant in sync", () => {
    const controller = createKCController({
      itemIds: ["alpha", "beta"],
      activeItemId: "beta",
    });
    const { root, attributes } = rootElement();
    const domController = new KCDomController(controller, root, {
      entries: entries(),
    });

    domController.mount();

    expect(root.tabIndex).toBe(0);
    expect(attributes.get("role")).toBe("listbox");
    expect(attributes.get("aria-orientation")).toBe("vertical");
    expect(attributes.get("aria-activedescendant")).toBe("todos-item-beta");

    controller.api.setActiveItemId("alpha");
    expect(attributes.get("aria-activedescendant")).toBe("todos-item-alpha");

    controller.api.setRegisteredEntries([]);
    domController.update({ entries: [] });
    expect(attributes.has("aria-activedescendant")).toBe(false);
  });

  it("registers keyboard handling in capture phase and ignores modifier-only keys", () => {
    const controller = createKCController({ itemIds: ["alpha", "beta"] });
    const { root, listeners } = rootElement();
    const domController = new KCDomController(controller, root, {
      keymap: createDefaultKCCollectionKeymap(),
      entries: entries(),
    });

    domController.mount();

    expect(root.addEventListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
      { capture: true }
    );

    const shift = keydownEvent({ key: "Shift", shiftKey: true });
    listeners.get("keydown")?.(shift);

    expect(shift.preventDefault).not.toHaveBeenCalled();
    expect(controller.getState().activeItemId).toBe("alpha");
  });

  it("runs movement commands and prevents matched keyboard events", () => {
    const controller = createKCController({ itemIds: ["alpha", "beta"] });
    const { root, listeners } = rootElement();
    const domController = new KCDomController(controller, root, {
      keymap: createDefaultKCCollectionKeymap(),
      entries: entries(),
    });
    const event = keydownEvent({ key: "ArrowDown" });

    domController.mount();
    listeners.get("keydown")?.(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(controller.getState().activeItemId).toBe("beta");
  });

  it("ignores keyboard routing from editable descendants", () => {
    const action = vi.fn();
    const controller = createKCController({ itemIds: ["alpha", "beta"] });
    const { root, listeners } = rootElement();
    const domController = new KCDomController(controller, root, {
      entries: entries([
        {
          sequence: "Space",
          command: "activate",
          action,
        },
      ]),
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
    expect(controller.getState().activeItemId).toBe("alpha");
  });

  it("runs custom actions for the active entry", () => {
    const action = vi.fn();
    const controller = createKCController({
      itemIds: ["alpha", "beta"],
      activeItemId: "beta",
    });
    const { root, listeners } = rootElement();
    const domController = new KCDomController(controller, root, {
      entries: entries([
        {
          sequence: "Enter",
          command: "activate",
          action,
        },
      ]),
    });
    const event = keydownEvent({ key: "Enter" });

    domController.mount();
    listeners.get("keydown")?.(event);

    expect(action).toHaveBeenCalledWith({
      id: "beta",
      index: 1,
      data: "beta",
      isCollectionFocused: false,
      isItemActive: true,
    });
  });
});
