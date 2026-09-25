import { describe, expect, it, vi } from "vitest";
import { createShortcutEngine, parseKeySequence, type ShortcutBinding } from "../src";

function event(key: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { key, ctrlKey: false, shiftKey: false, metaKey: false, altKey: false,
    preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extra } as unknown as KeyboardEvent;
}
function binding(sequence: string, action = vi.fn(), extra: Partial<ShortcutBinding> = {}): ShortcutBinding {
  return { sequence: parseKeySequence(sequence), action, ...extra };
}
function setup() {
  const engine = createShortcutEngine();
  engine.registerScope({ id: "root", parentId: null });
  engine.registerScope({ id: "pane", parentId: "root" });
  engine.registerScope({ id: "control", parentId: "pane" });
  engine.registerScope({ id: "sibling", parentId: "root" });
  engine.setActiveScope("control");
  return engine;
}

describe("scoped shortcut engine", () => {
  it("runs only the deepest complete match and never evaluates siblings", () => {
    const engine = setup();
    const root = vi.fn(), pane = vi.fn(), control = vi.fn(), sibling = vi.fn();
    engine.registerBindings("root", [binding("K", root)]);
    engine.registerBindings("pane", [binding("K", pane)]);
    const registration = engine.registerBindings("control", [binding("K", control)]);
    engine.registerBindings("sibling", [binding("K", sibling, { when: () => { throw Error("Wrong path"); } })]);
    const key = event("k");
    expect(engine.handle(key)).toBe("handled");
    expect(control).toHaveBeenCalledWith(key);
    expect(pane).not.toHaveBeenCalled();
    expect(root).not.toHaveBeenCalled();
    expect(sibling).not.toHaveBeenCalled();
    registration.dispose();
    engine.handle(event("k"));
    expect(pane).toHaveBeenCalledOnce();
  });

  it("runs a complete ancestor immediately despite a deeper partial match", () => {
    const engine = setup(), child = vi.fn(), parent = vi.fn();
    engine.registerBindings("control", [binding("Ctrl-K A", child)]);
    engine.registerBindings("root", [binding("Ctrl-K", parent)]);
    expect(engine.handle(event("k", { ctrlKey: true }))).toBe("handled");
    expect(parent).toHaveBeenCalledOnce();
    expect(engine.handle(event("a"))).toBe("ignored");
    expect(child).not.toHaveBeenCalled();
  });

  it("keeps ancestor candidates during a shared prefix", () => {
    const engine = setup(), child = vi.fn(), parent = vi.fn();
    engine.registerBindings("control", [binding("Ctrl-K A", child)]);
    engine.registerBindings("root", [binding("Ctrl-K B", parent)]);
    expect(engine.handle(event("k", { ctrlKey: true }))).toBe("pending");
    engine.handle(event("b"));
    expect(parent).toHaveBeenCalledOnce();
    engine.handle(event("k", { ctrlKey: true }));
    engine.handle(event("a"));
    expect(child).toHaveBeenCalledOnce();
  });

  it("restores previous contributors and keeps update priority stable", () => {
    const engine = setup(), first = vi.fn(), second = vi.fn(), updated = vi.fn();
    const a = engine.registerBindings("control", [binding("K", first)]);
    const b = engine.registerBindings("control", [binding("K", second)]);
    a.update([binding("K", updated)]);
    engine.handle(event("k"));
    expect(second).toHaveBeenCalledOnce();
    b.dispose(); b.dispose();
    engine.handle(event("k"));
    expect(updated).toHaveBeenCalledOnce();
    a.dispose();
    expect(engine.handle(event("k"))).toBe("ignored");
  });

  it("allows latest disabled bindings to fall back without reserving prefixes", () => {
    const engine = setup(), first = vi.fn();
    engine.registerBindings("root", [binding("K", first)]);
    engine.registerBindings("control", [binding("K", vi.fn(), { when: () => false }), binding("G G", vi.fn(), { when: () => false })]);
    engine.handle(event("k"));
    expect(first).toHaveBeenCalledOnce();
    expect(engine.handle(event("g"))).toBe("ignored");
  });

  it("preserves a prefix across callback updates but resets on structural changes", () => {
    const engine = setup(), old = vi.fn(), current = vi.fn();
    const registration = engine.registerBindings("control", [binding("G G", old)]);
    engine.handle(event("g"));
    registration.update([binding("G G", current)]);
    engine.handle(event("g"));
    expect(current).toHaveBeenCalledOnce();
    expect(old).not.toHaveBeenCalled();
    engine.handle(event("g"));
    registration.update([binding("G H", current)]);
    expect(engine.handle(event("h"))).toBe("ignored");
  });

  it("resets sequences on active scope changes and subtree removal", () => {
    const engine = setup(), action = vi.fn();
    engine.registerBindings("root", [binding("G G", action)]);
    engine.handle(event("g"));
    engine.setActiveScope("sibling");
    expect(engine.handle(event("g"))).toBe("pending");
    expect(action).not.toHaveBeenCalled();
    const remove = engine.registerScope({ id: "temporary", parentId: "root" });
    engine.setActiveScope("temporary");
    engine.handle(event("g"));
    remove(); remove();
    expect(engine.getActiveScopeId()).toBe("root");
    expect(engine.handle(event("g"))).toBe("pending");
  });

  it("commits before actions so callback focus changes clear retained state", () => {
    const engine = setup();
    engine.registerBindings("control", [binding("G G", vi.fn(() => engine.setActiveScope("sibling")), { repeat: true })]);
    engine.handle(event("g")); engine.handle(event("g"));
    expect(engine.handle(event("g"))).toBe("ignored");
  });

  it("filters modifier events and normalizes shifted symbols in pending sequences", () => {
    const engine = setup(), action = vi.fn();
    engine.registerBindings("root", [binding("Ctrl-B %", action)]);
    const prefix = event("b", { ctrlKey: true });
    engine.handle(prefix);
    expect(prefix.preventDefault).toHaveBeenCalledOnce();
    expect(engine.handle(event("Shift", { shiftKey: true }))).toBe("ignored");
    const follower = event("5", { shiftKey: true });
    engine.handle(follower);
    expect(action).toHaveBeenCalledWith(follower);
    expect(follower.preventDefault).toHaveBeenCalledOnce();
  });

  it("consumes invalid continuations and supports restarting on a fresh binding", () => {
    const engine = setup(), fresh = vi.fn();
    engine.registerBindings("root", [binding("G G"), binding("X", fresh)]);
    engine.handle(event("g"));
    const invalid = event("z");
    expect(engine.handle(invalid)).toBe("handled");
    expect(invalid.preventDefault).toHaveBeenCalledOnce();
    engine.handle(event("g")); engine.handle(event("x"));
    expect(fresh).toHaveBeenCalledOnce();
  });

  it("executes only one callback even when browser defaults are allowed", () => {
    const engine = setup(), parent = vi.fn(), child = vi.fn();
    engine.registerBindings("root", [binding("K", parent)]);
    engine.registerBindings("control", [binding("K", child, { preventDefault: false })]);
    const key = event("k");
    engine.handle(key);
    expect(child).toHaveBeenCalledOnce();
    expect(parent).not.toHaveBeenCalled();
    expect(key.preventDefault).not.toHaveBeenCalled();
  });

  it("retains repeatable leaders, consumes nonrepeatable followers, and expires", () => {
    let now = 0;
    const engine = createShortcutEngine({ now: () => now, repeatTimeoutMs: 300 });
    engine.registerScope({ id: "root", parentId: null });
    const left = vi.fn(), right = vi.fn(), close = vi.fn();
    engine.registerBindings("root", [binding("Ctrl-B H", left, { repeat: true }), binding("Ctrl-B L", right, { repeat: true }), binding("Ctrl-B X", close)]);
    engine.setActiveScope("root");
    engine.handle(event("b", { ctrlKey: true })); engine.handle(event("l"));
    now = 200; engine.handle(event("h"));
    expect(left).toHaveBeenCalledOnce(); expect(right).toHaveBeenCalledOnce();
    engine.handle(event("x")); expect(close).not.toHaveBeenCalled();
    engine.handle(event("b", { ctrlKey: true })); engine.handle(event("l"));
    now = 501; expect(engine.handle(event("h"))).toBe("ignored");
  });

  it("rejects cycles, duplicate scope ids, and empty sequences", () => {
    const engine = setup();
    expect(() => engine.registerScope({ id: "root", parentId: null })).toThrow("Duplicate");
    engine.registerScope({ id: "a", parentId: "b" });
    expect(() => engine.registerScope({ id: "b", parentId: "a" })).toThrow("cycle");
    expect(() => engine.registerBindings("root", [binding("")])).toThrow("empty");
  });
});
