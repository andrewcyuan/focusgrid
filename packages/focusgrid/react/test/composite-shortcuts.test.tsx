import { describe, expect, it, vi } from "vitest";
import { createShortcutEngine } from "@andrewcyuan/shortcut-engine";
import { createCompositeNavigationKeymap } from "../src/index";

describe("composite navigation callbacks", () => {
  it.each([ ["ArrowLeft", "left"], ["ArrowRight", "right"], ["ArrowUp", "up"], ["ArrowDown", "down"], ["Home", "start"], ["End", "end"] ])("routes %s to %s", (key, direction) => {
    const engine = createShortcutEngine(), move = vi.fn();
    engine.registerScope({ id: "list", parentId: null });
    engine.registerBindings("list", createCompositeNavigationKeymap(move));
    engine.setActiveScope("list");
    const event = { key, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as KeyboardEvent;
    engine.handle(event);
    expect(move).toHaveBeenCalledWith(direction, event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("leaves editable navigation to the browser", () => {
    const engine = createShortcutEngine(), move = vi.fn();
    engine.registerScope({ id: "list", parentId: null });
    engine.registerBindings("list", createCompositeNavigationKeymap(move));
    engine.setActiveScope("list");
    const event = { key: "ArrowDown", target: { tagName: "TEXTAREA" }, preventDefault: vi.fn() } as unknown as KeyboardEvent;
    expect(engine.handle(event)).toBe("ignored");
    expect(move).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
