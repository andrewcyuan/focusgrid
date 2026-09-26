import { describe, expect, it, vi } from "vitest";
import { FocusGridController, type FocusGridControllerState } from "../src";

function state(): FocusGridControllerState {
  return {
    root: { kind: "split", id: "root", orientation: "horizontal", sizes: [1, 1], children: [
      { kind: "pane", id: "a-node", paneId: "a" },
      { kind: "pane", id: "b-node", paneId: "b" },
    ] },
    activePaneId: "a", container: { width: 800, height: 600 },
  };
}

describe("injected DOM focus", () => {
  it("requests focus before emitting the active-pane change", () => {
    const calls: string[] = [];
    const controller = new FocusGridController(state(), { focus: id => { calls.push(`focus:${id}`); return true; } });
    controller.subscribe(next => calls.push(`active:${next.activePaneId}`));
    expect(controller.focusAdjacent("right")).toBe(true);
    expect(calls).toEqual(["focus:b", "active:b"]);
  });

  it("leaves state unchanged on missing DOM targets and allows a later retry", () => {
    const focus = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const controller = new FocusGridController(state(), { focus });
    const listener = vi.fn();
    controller.subscribe(listener);
    expect(controller.focusAdjacent("right")).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.focusAdjacent("right")).toBe(true);
    expect(focus.mock.calls).toEqual([["b"], ["b"]]);
    expect(listener.mock.calls[0][0].activePaneId).toBe("b");
  });

  it("does not request DOM focus for missing neighbors or DOM-to-core synchronization", () => {
    const focus = vi.fn();
    const controller = new FocusGridController(state(), { focus });
    expect(controller.focusAdjacent("left")).toBe(false);
    controller.focus("b");
    expect(focus).not.toHaveBeenCalled();
  });

  it("succeeds when a synchronous focus event already synchronized core", () => {
    const controller = new FocusGridController(state(), { focus: id => { controller.focus(id); return true; } });
    const listener = vi.fn();
    controller.subscribe(listener);
    expect(controller.focusAdjacent("right")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
