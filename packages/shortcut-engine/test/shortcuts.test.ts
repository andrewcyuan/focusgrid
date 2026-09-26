import { expect, it, vi } from "vitest";
import { createShortcutEngine, normalizeKeyboardEvent, normalizeShortcut, type ShortcutBinding } from "../src";

const binding = (sequence: string, action = vi.fn(), extra: Partial<ShortcutBinding> = {}): ShortcutBinding => ({ sequence, action, ...extra });
const key = (key: string, extra: Partial<KeyboardEvent> = {}) => ({
  key, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extra,
}) as unknown as KeyboardEvent;
function setup() {
  const engine = createShortcutEngine();
  engine.registerScope({ id: "root", parentId: null });
  engine.registerScope({ id: "child", parentId: "root" });
  engine.registerScope({ id: "sibling", parentId: "root" });
  engine.setActiveScope("child");
  return engine;
}

it.each([
  ["Ctrl-K A", "ctrl-k a"], ["shift-ctrl-A", "ctrl-shift-a"],
  ["cmd-alt-Left", "cmd-alt-left"], ["Ctrl-- Ctrl-+", "ctrl-- ctrl-+"],
  ["shift-5", "%"], ["  g   g ", "g g"],
])("normalizes %s to %s", (input, expected) => expect(normalizeShortcut(input)).toBe(expected));
it.each(["", "Ctrl+K", "meta-k", "control-k", "ctrl-"])("rejects %s", input => expect(() => normalizeShortcut(input)).toThrow());
it.each([
  [key("ArrowLeft", { ctrlKey: true }), "ctrl-left"],
  [key("5", { shiftKey: true }), "%"], [key("%", { shiftKey: true }), "%"],
  [key("A", { shiftKey: true }), "shift-a"], [key(" "), "space"], [key("Shift"), null],
])("normalizes browser events", (event, expected) => expect(normalizeKeyboardEvent(event)).toBe(expected));

it("chooses complete matches deepest first while keeping ancestor prefix candidates", () => {
  const engine = setup(), parent = vi.fn(), child = vi.fn();
  engine.registerBindings("root", [binding("ctrl-k", parent), binding("g b", parent), binding("x", parent)]);
  engine.registerBindings("child", [binding("ctrl-k a", child), binding("g a", child), binding("x", child)]);
  engine.registerBindings("sibling", [binding("x", vi.fn(), { when: () => { throw Error("Wrong branch"); } })]);
  engine.handle(key("k", { ctrlKey: true }));
  expect(parent).toHaveBeenCalledTimes(1);
  expect(engine.handle(key("a"))).toBe("ignored");
  engine.handle(key("g")); engine.handle(key("b"));
  expect(parent).toHaveBeenCalledTimes(2);
  engine.handle(key("g")); engine.handle(key("a")); engine.handle(key("x"));
  expect(child).toHaveBeenCalledTimes(2);
});

it("keeps contributor priority and pending state across callback updates, and restores bindings on cleanup", () => {
  const engine = setup(), first = vi.fn(), latest = vi.fn(), updated = vi.fn();
  const a = engine.registerBindings("child", [binding("g g", first)]);
  const b = engine.registerBindings("child", [binding("g g", latest)]);
  engine.handle(key("g")); a.update([binding("g g", updated)]); engine.handle(key("g"));
  expect(latest).toHaveBeenCalledOnce();
  b.dispose(); b.dispose();
  engine.handle(key("g")); engine.handle(key("g"));
  expect(updated).toHaveBeenCalledOnce(); expect(first).not.toHaveBeenCalled();
  a.update([binding("g g", updated, { when: () => false })]);
  expect(engine.handle(key("g"))).toBe("ignored");
});

it("resets on scope or binding changes, consumes invalid continuations, and allows browser defaults when requested", () => {
  const engine = setup(), action = vi.fn();
  const registration = engine.registerBindings("root", [binding("g g", action)]);
  engine.handle(key("g")); engine.setActiveScope("sibling");
  expect(engine.handle(key("g"))).toBe("pending"); expect(action).not.toHaveBeenCalled();
  const invalid = key("z"); engine.handle(invalid);
  expect(invalid.preventDefault).toHaveBeenCalledOnce();
  engine.handle(key("g")); registration.update([binding("g h", action)]);
  expect(engine.handle(key("h"))).toBe("ignored");
  registration.update([binding("x", action, { preventDefault: false })]);
  const event = key("x"); engine.handle(event);
  expect(action).toHaveBeenCalledWith(event); expect(event.preventDefault).not.toHaveBeenCalled();
});

it("retains repeat leaders until timeout but clears them when the callback changes scopes", () => {
  let now = 0;
  const engine = createShortcutEngine({ now: () => now, repeatTimeoutMs: 300 }), action = vi.fn();
  engine.registerScope({ id: "root", parentId: null }); engine.setActiveScope("root");
  const registration = engine.registerBindings("root", [binding("ctrl-b %", action, { repeat: true })]);
  engine.handle(key("b", { ctrlKey: true })); engine.handle(key("Shift"));
  engine.handle(key("5", { shiftKey: true })); engine.handle(key("5", { shiftKey: true }));
  expect(action).toHaveBeenCalledTimes(2);
  now = 301; expect(engine.handle(key("5", { shiftKey: true }))).toBe("ignored");
  registration.update([binding("g g", vi.fn(() => engine.setActiveScope(null)), { repeat: true })]);
  engine.handle(key("g")); engine.handle(key("g"));
  expect(engine.handle(key("g"))).toBe("ignored");
});

it("supports contributors mounting before scopes, rejects cycles, and makes cleanup safe", () => {
  const engine = createShortcutEngine(), action = vi.fn();
  const registration = engine.registerBindings("child", [binding("x", action)]);
  const removeChild = engine.registerScope({ id: "child", parentId: "root" });
  engine.setActiveScope("child"); expect(engine.handle(key("x"))).toBe("ignored");
  expect(() => engine.registerScope({ id: "root", parentId: "child" })).toThrow("cycle");
  const removeRoot = engine.registerScope({ id: "root", parentId: null });
  expect(() => engine.registerScope({ id: "root", parentId: null })).toThrow("Duplicate");
  engine.handle(key("x")); expect(action).toHaveBeenCalledOnce();
  removeRoot(); removeChild(); removeChild(); registration.dispose(); registration.dispose();
  expect(engine.handle(key("x"))).toBe("ignored");
});

it("starts a new prefix and runs direct bindings during the repeat window", () => {
  const engine = setup(), resize = vi.fn(), split = vi.fn(), focus = vi.fn();
  engine.registerBindings("root", [
    binding("ctrl-b l", resize, { repeat: true }),
    binding("ctrl-b %", split),
    binding("ctrl-h", focus),
  ]);
  engine.handle(key("b", { ctrlKey: true }));
  engine.handle(key("l"));
  expect(engine.handle(key("b", { ctrlKey: true }))).toBe("pending");
  engine.handle(key("5", { shiftKey: true }));
  expect(split).toHaveBeenCalledOnce();
  engine.handle(key("b", { ctrlKey: true }));
  engine.handle(key("l"));
  engine.handle(key("h", { ctrlKey: true }));
  expect(focus).toHaveBeenCalledOnce();
  expect(resize).toHaveBeenCalledTimes(2);
});

it("keeps an initial prefix pending regardless of the repeat timeout", () => {
  let now = 0;
  const engine = createShortcutEngine({ now: () => now }), action = vi.fn();
  engine.registerScope({ id: "root", parentId: null });
  engine.registerBindings("root", [binding("ctrl-s |", action)]);
  engine.setActiveScope("root");
  engine.handle(key("s", { ctrlKey: true }));
  now = 10_000;
  engine.handle(key("\\", { shiftKey: true }));
  expect(action).toHaveBeenCalledOnce();
});
