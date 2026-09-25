import { describe, expect, it, vi } from "vitest";
import { createShortcutEngine, parseKeySequence } from "../src";

function element(parentElement: Element | null = null): Element {
  return { parentElement, getRootNode: () => ({}) } as Element;
}
function documentFixture(activeElement: Element | null) {
  const listeners = new Map<string, (event: any) => void>();
  const windowListeners = new Map<string, () => void>();
  const document = {
    activeElement,
    addEventListener: vi.fn((name, callback) => listeners.set(name, callback)),
    removeEventListener: vi.fn((name) => listeners.delete(name)),
    defaultView: {
      addEventListener: vi.fn((name, callback) => windowListeners.set(name, callback)),
      removeEventListener: vi.fn((name) => windowListeners.delete(name)),
    },
  } as unknown as Document;
  return { document, listeners, windowListeners };
}

describe("shortcut engine lifecycle", () => {
  it("mounts one capture listener, tracks focus, and cleans up idempotently", () => {
    const root = element(), child = element(root), external = element();
    const { document, listeners, windowListeners } = documentFixture(child);
    const engine = createShortcutEngine();
    engine.registerScope({ id: "root", parentId: null, element: root });
    engine.registerScope({ id: "child", parentId: "root", element: child });
    const unmount = engine.mount(document);
    expect(engine.mount(document)).toBe(unmount);
    expect(engine.getActiveScopeId()).toBe("child");
    expect(document.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    expect(document.addEventListener).toHaveBeenCalledTimes(3);
    listeners.get("focusout")!({ relatedTarget: external });
    expect(engine.getActiveScopeId()).toBeNull();
    listeners.get("focusin")!({ composedPath: () => [child, root] });
    expect(engine.getActiveScopeId()).toBe("child");
    windowListeners.get("blur")!();
    expect(engine.getActiveScopeId()).toBeNull();
    windowListeners.get("focus")!();
    expect(engine.getActiveScopeId()).toBe("child");
    expect(() => createShortcutEngine().mount(document)).toThrow("shared shortcut engine");
    unmount(); unmount();
    expect(listeners.size).toBe(0);
    expect(windowListeners.size).toBe(0);
    expect(engine.getActiveScopeId()).toBeNull();
    expect(document.removeEventListener).toHaveBeenCalledTimes(3);
    const remount = engine.mount(document);
    expect(engine.getActiveScopeId()).toBe("child");
    remount();
  });

  it("resolves logical parents for a scope mounted outside its parent's element", () => {
    const root = element(), portal = element();
    const { document, listeners } = documentFixture(portal);
    const engine = createShortcutEngine(), action = vi.fn();
    engine.registerScope({ id: "root", parentId: null, element: root });
    engine.registerScope({ id: "portal", parentId: "root", element: portal });
    engine.registerBindings("root", [{ sequence: parseKeySequence("K"), action }]);
    const cleanup = engine.mount(document);
    listeners.get("keydown")!({ key: "k", preventDefault() {}, stopPropagation() {} });
    expect(action).toHaveBeenCalledOnce();
    cleanup();
  });

  it("supports contributions before scopes and safe cleanup in either order", () => {
    const engine = createShortcutEngine(), action = vi.fn();
    const bindings = engine.registerBindings("child", [{ sequence: parseKeySequence("K"), action }]);
    const removeChild = engine.registerScope({ id: "child", parentId: "parent" });
    engine.setActiveScope("child");
    const key = () => ({ key: "k", preventDefault() {}, stopPropagation() {} }) as KeyboardEvent;
    expect(engine.handle(key())).toBe("ignored");
    const removeParent = engine.registerScope({ id: "parent", parentId: null });
    engine.handle(key());
    expect(action).toHaveBeenCalledOnce();
    removeParent(); removeChild(); bindings.dispose();
    expect(engine.getActiveScopeId()).toBeNull();
    expect(engine.handle(key())).toBe("ignored");
  });

  it("clears an explicitly active orphan when it is removed", () => {
    const engine = createShortcutEngine();
    const remove = engine.registerScope({ id: "orphan", parentId: "later" });
    engine.setActiveScope("orphan");
    remove();
    expect(engine.getActiveScopeId()).toBeNull();
  });
});
