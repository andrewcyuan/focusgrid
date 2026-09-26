import { afterEach, describe, expect, it, vi } from "vitest";
import { FocusGridController, findPaneNode, validateFocusGridControllerState, type FocusGridControllerProps } from "../src";
import * as ids from "../src/utils/ids";

function props(): FocusGridControllerProps {
  return {
    root: { kind: "pane", id: "editor-node", paneId: "editor" },
    activePaneId: "editor",
    container: { width: 1000, height: 600 },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("public controller methods", () => {
  it("keeps minimum sizes on the controller and out of pane state", () => {
    const controller = new FocusGridController({ ...props(), minWidth: 120, minHeight: 90 });
    controller.split("editor-node", { side: "right", newPaneId: "terminal" });
    expect(controller.minWidth).toBe(120);
    expect(controller.minHeight).toBe(90);
    for (const id of ["editor", "terminal"]) {
      const pane = findPaneNode(controller.state.root, id);
      expect(pane).not.toHaveProperty("minWidth");
      expect(pane).not.toHaveProperty("minHeight");
    }
    expect(validateFocusGridControllerState(controller.state).ok).toBe(true);
    expect(new FocusGridController(props()).minWidth).toBe(0);
    expect(new FocusGridController(props()).minHeight).toBe(0);
  });

  it("rejects invalid controller minimums", () => {
    for (const key of ["minWidth", "minHeight"]) {
      for (const value of [-1, NaN, Infinity]) {
        expect(() => new FocusGridController({ ...props(), [key]: value })).toThrow(RangeError);
      }
    }
  });

  it("preserves supplied IDs without generating replacements", () => {
    const createId = vi.spyOn(ids, "createId");
    const controller = new FocusGridController(props());
    expect(controller.split("editor-node", {
      side: "right", newPaneId: "terminal", newPaneNodeId: "terminal-node", splitId: "workspace",
    })).toBe("terminal");
    expect(createId).not.toHaveBeenCalled();
    expect(controller.state.root).toMatchObject({
      id: "workspace", children: [{ id: "editor-node", paneId: "editor" }, { id: "terminal-node", paneId: "terminal" }],
    });
    expect(validateFocusGridControllerState(controller.state).ok).toBe(true);
  });

  it("generates only omitted IDs", () => {
    const createId = vi.spyOn(ids, "createId");
    const controller = new FocusGridController(props());
    expect(controller.split("editor-node", { side: "down", newPaneNodeId: "output-node" })).toMatch(/^pane-/);
    expect(createId.mock.calls).toEqual([["pane"], ["split"]]);
    expect(controller.state.root).toMatchObject({ children: [{ id: "editor-node" }, { id: "output-node" }] });
  });

  it("rejects split nodes, pane IDs, and missing nodes without notifying", () => {
    const controller = new FocusGridController(props());
    controller.split("editor-node", { side: "right", splitId: "workspace" });
    const before = controller.state;
    const listener = vi.fn();
    controller.subscribe(listener);
    for (const target of ["workspace", "editor", "missing"]) {
      expect(controller.split(target, { side: "down" })).toBeNull();
      expect(controller.state).toBe(before);
    }
    expect(listener).not.toHaveBeenCalled();
  });

  it("rejects duplicate pane and node IDs without committing an invalid tree", () => {
    const controller = new FocusGridController(props());
    const before = controller.state;
    for (const patch of [
      { newPaneId: "editor" }, { newPaneNodeId: "editor-node" },
      { splitId: "editor-node" }, { newPaneNodeId: "same", splitId: "same" },
    ]) {
      expect(controller.split("editor-node", { side: "right", ...patch })).toBeNull();
      expect(controller.state).toBe(before);
    }
  });

  it("applies defaults on construction and pane creation while preserving explicit values", () => {
    const initial = props();
    initial.root = { ...initial.root, canRemove: true };
    const controller = new FocusGridController({
      ...initial, paneDefaults: { canRemove: false, canFocus: false },
    });
    expect(findPaneNode(controller.state.root, "editor")).toMatchObject({ canRemove: true, canFocus: false });
    expect(initial.root).not.toHaveProperty("canFocus");
    controller.split("editor-node", { side: "right", newPaneId: "terminal", canFocus: true });
    expect(findPaneNode(controller.state.root, "terminal")).toMatchObject({ canRemove: false, canFocus: true });
  });

  it("patches pane fields together while preserving identity and omitted fields", () => {
    const controller = new FocusGridController(props());
    controller.split("editor-node", { side: "right", newPaneId: "terminal" });
    const sibling = findPaneNode(controller.state.root, "terminal");
    const previous = controller.state;
    const listener = vi.fn();
    controller.subscribe(listener);
    expect(controller.updatePane("editor", { canRemove: false })).toBe(true);
    expect(findPaneNode(controller.state.root, "editor")).toEqual({ kind: "pane", id: "editor-node", paneId: "editor", canRemove: false });
    expect(findPaneNode(controller.state.root, "terminal")).toBe(sibling);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(controller.state, previous);
    expect(controller.updatePane("editor", { canResizeX: false })).toBe(true);
    expect(findPaneNode(controller.state.root, "editor")?.canRemove).toBe(false);
  });

  it("preserves state and notifications for unchanged patches and unsubscribes", () => {
    const controller = new FocusGridController(props());
    controller.updatePane("editor", { canFocus: false });
    const before = controller.state;
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    for (const patch of [{}, { canFocus: false }, { canRemove: undefined }]) {
      expect(controller.updatePane("editor", patch)).toBe(false);
      expect(controller.state).toBe(before);
    }
    expect(controller.updatePane("missing", { canRemove: false })).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.updatePane("editor", { canFocus: undefined })).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    controller.updatePane("editor", { canRemove: false });
    expect(findPaneNode(controller.state.root, "editor")?.canRemove).toBe(false);
    controller.updatePane("editor", { canRemove: undefined });
    expect(findPaneNode(controller.state.root, "editor")).not.toHaveProperty("canRemove");
    expect(validateFocusGridControllerState(controller.state).ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("uses pane defaults when creation props are omitted or undefined", () => {
    const controller = new FocusGridController({
      ...props(), paneDefaults: { canFocus: false },
    });
    controller.split("editor-node", {
      side: "right", newPaneId: "terminal",
      canFocus: undefined,
    });
    expect(findPaneNode(controller.state.root, "terminal")).toMatchObject({ canFocus: false });
    expect(findPaneNode(controller.state.root, "terminal")).not.toHaveProperty("canRemove");
    expect(validateFocusGridControllerState(controller.state).ok).toBe(true);
  });

  it("preserves one snapshot and emits no notifications across unchanged controller operations", () => {
    const controller = new FocusGridController(props());
    controller.split("editor-node", { side: "right", newPaneId: "terminal", splitId: "workspace" });
    const before = controller.state;
    const listener = vi.fn();
    controller.subscribe(listener);
    expect(controller.focus("terminal")).toBe(false);
    expect(controller.resize("editor", { direction: "right", deltaPx: 0 })).toBe(false);
    expect(controller.resizeHandle("workspace", { index: 0, deltaPx: 0 })).toBe(false);
    expect(controller.remove("missing")).toBe(false);
    expect(controller.swap("editor", "editor")).toBe(false);
    expect(controller.updatePane("editor", {})).toBe(false);
    expect(controller.setContainerSize(1000, 600)).toBe(false);
    expect(controller.state).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

});
