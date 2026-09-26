import { describe, expect, it, vi } from "vitest";
import { createShortcutEngine } from "../src";
import { mountShortcutListener } from "../src/react/shortcut-listener";

function fixture() {
  const document = Object.assign(new EventTarget(), { activeElement: null, defaultView: new EventTarget() });
  const engine = createShortcutEngine();
  engine.registerScope({ id: "root", parentId: null });
  const action = vi.fn();
  engine.registerBindings("root", [{ sequence: "a", action }]);
  const keydown = () => document.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: "a" }));
  return { document: document as unknown as Document, engine, action, keydown };
}

describe("React document listener ownership", () => {
  it("keeps a single capture listener until the final consumer leaves", () => {
    const { document, engine, action, keydown } = fixture();
    const add = vi.spyOn(document, "addEventListener");
    const first = mountShortcutListener(engine, document, "root");
    const second = mountShortcutListener(engine, document, "root");
    expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
    expect(add.mock.calls[0][2]).toMatchObject({ capture: true });
    keydown();
    expect(action).toHaveBeenCalledTimes(1);
    first(); first();
    keydown();
    expect(action).toHaveBeenCalledTimes(2);
    second();
    keydown();
    expect(action).toHaveBeenCalledTimes(2);
    expect(engine.getActiveScopeId()).toBeNull();
  });

  it("mounts cleanly again after all consumers leave", () => {
    const { document, engine, action, keydown } = fixture();
    const release = mountShortcutListener(engine, document, "root");
    release();
    const remount = mountShortcutListener(engine, document, "root");
    release();
    keydown();
    expect(action).toHaveBeenCalledTimes(1);
    remount();
  });
});
