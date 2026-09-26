import { createController, observedState } from "./observe-controller";
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
  it("does not expose a public state property", () => {
    expect("state" in createController(props())).toBe(false);
  });

  it("keeps minimum sizes on the controller and out of pane state", () => {
    const controller = createController({ ...props(), minWidth: 120, minHeight: 90 });
    controller.split("editor-node", { side: "right", newPaneId: "terminal" });
    expect(controller.minWidth).toBe(120);
    expect(controller.minHeight).toBe(90);
    for (const id of ["editor", "terminal"]) {
      const pane = findPaneNode(observedState(controller).root, id);
      expect(pane).not.toHaveProperty("minWidth");
      expect(pane).not.toHaveProperty("minHeight");
    }
    expect(validateFocusGridControllerState(observedState(controller)).ok).toBe(true);
    expect(createController(props()).minWidth).toBe(0);
    expect(createController(props()).minHeight).toBe(0);
  });

  it("rejects invalid controller minimums", () => {
    for (const key of ["minWidth", "minHeight"]) {
      for (const value of [-1, NaN, Infinity]) {
        expect(() => createController({ ...props(), [key]: value })).toThrow(RangeError);
      }
    }
  });

  it("preserves supplied IDs without generating replacements", () => {
    const createId = vi.spyOn(ids, "createId");
    const controller = createController(props());
    expect(controller.split("editor-node", {
      side: "right", newPaneId: "terminal", newPaneNodeId: "terminal-node", splitId: "workspace",
    })).toBe("terminal");
    expect(createId).not.toHaveBeenCalled();
    expect(observedState(controller).root).toMatchObject({
      id: "workspace", children: [{ id: "editor-node", paneId: "editor" }, { id: "terminal-node", paneId: "terminal" }],
    });
    expect(validateFocusGridControllerState(observedState(controller)).ok).toBe(true);
  });

  it("generates only omitted IDs", () => {
    const createId = vi.spyOn(ids, "createId");
    const controller = createController(props());
    expect(controller.split("editor-node", { side: "down", newPaneNodeId: "output-node" })).toMatch(/^pane-/);
    expect(createId.mock.calls).toEqual([["pane"], ["split"]]);
    expect(observedState(controller).root).toMatchObject({ children: [{ id: "editor-node" }, { id: "output-node" }] });
  });

  it("rejects split nodes, pane IDs, and missing nodes without notifying", () => {
    const controller = createController(props());
    controller.split("editor-node", { side: "right", splitId: "workspace" });
    const before = observedState(controller);
    const listener = vi.fn();
    controller.subscribe(listener);
    for (const target of ["workspace", "editor", "missing"]) {
      expect(controller.split(target, { side: "down" })).toBeNull();
      expect(observedState(controller)).toBe(before);
    }
    expect(listener).not.toHaveBeenCalled();
  });

  it("rejects duplicate pane and node IDs without committing an invalid tree", () => {
    const controller = createController(props());
    const before = observedState(controller);
    for (const patch of [
      { newPaneId: "editor" }, { newPaneNodeId: "editor-node" },
      { splitId: "editor-node" }, { newPaneNodeId: "same", splitId: "same" },
    ]) {
      expect(controller.split("editor-node", { side: "right", ...patch })).toBeNull();
      expect(observedState(controller)).toBe(before);
    }
  });

  it("applies defaults on construction and pane creation while preserving explicit values", () => {
    const initial = props();
    initial.root = { ...initial.root, canRemove: true };
    const controller = createController({
      ...initial, paneDefaults: { canRemove: false, canFocus: false },
    });
    expect(initial.root).not.toHaveProperty("canFocus");
    controller.split("editor-node", { side: "right", newPaneId: "terminal", canFocus: true });
    expect(findPaneNode(observedState(controller).root, "editor")).toMatchObject({ canRemove: true, canFocus: false });
    expect(findPaneNode(observedState(controller).root, "terminal")).toMatchObject({ canRemove: false, canFocus: true });
  });

  it("patches pane fields together while preserving identity and omitted fields", () => {
    const controller = createController(props());
    controller.split("editor-node", { side: "right", newPaneId: "terminal" });
    const sibling = findPaneNode(observedState(controller).root, "terminal");
    const previous = observedState(controller);
    const listener = vi.fn();
    controller.subscribe(listener);
    expect(controller.updatePane("editor", { canRemove: false })).toBe(true);
    expect(findPaneNode(observedState(controller).root, "editor")).toEqual({ kind: "pane", id: "editor-node", paneId: "editor", canRemove: false });
    expect(findPaneNode(observedState(controller).root, "terminal")).toBe(sibling);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(observedState(controller), previous);
    expect(controller.updatePane("editor", { canResizeX: false })).toBe(true);
    expect(findPaneNode(observedState(controller).root, "editor")?.canRemove).toBe(false);
  });

  it("preserves state and notifications for unchanged patches and unsubscribes", () => {
    const controller = createController(props());
    controller.updatePane("editor", { canFocus: false });
    const before = observedState(controller);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    for (const patch of [{}, { canFocus: false }, { canRemove: undefined }]) {
      expect(controller.updatePane("editor", patch)).toBe(false);
      expect(observedState(controller)).toBe(before);
    }
    expect(controller.updatePane("missing", { canRemove: false })).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.updatePane("editor", { canFocus: undefined })).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    controller.updatePane("editor", { canRemove: false });
    expect(findPaneNode(observedState(controller).root, "editor")?.canRemove).toBe(false);
    controller.updatePane("editor", { canRemove: undefined });
    expect(findPaneNode(observedState(controller).root, "editor")).not.toHaveProperty("canRemove");
    expect(validateFocusGridControllerState(observedState(controller)).ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("uses pane defaults when creation props are omitted or undefined", () => {
    const controller = createController({
      ...props(), paneDefaults: { canFocus: false },
    });
    controller.split("editor-node", {
      side: "right", newPaneId: "terminal",
      canFocus: undefined,
    });
    expect(findPaneNode(observedState(controller).root, "terminal")).toMatchObject({ canFocus: false });
    expect(findPaneNode(observedState(controller).root, "terminal")).not.toHaveProperty("canRemove");
    expect(validateFocusGridControllerState(observedState(controller)).ok).toBe(true);
  });

  it("preserves one snapshot and emits no notifications across unchanged controller operations", () => {
    const controller = createController(props());
    controller.split("editor-node", { side: "right", newPaneId: "terminal", splitId: "workspace" });
    const before = observedState(controller);
    const listener = vi.fn();
    controller.subscribe(listener);
    expect(controller.focus("terminal")).toBe(false);
    expect(controller.resize("editor", { direction: "right", deltaPx: 0 })).toBe(false);
    expect(controller.resizeHandle("workspace", { index: 0, deltaPx: 0 })).toBe(false);
    expect(controller.remove("missing")).toBe(false);
    expect(controller.swap("editor", "editor")).toBe(false);
    expect(controller.updatePane("editor", {})).toBe(false);
    expect(controller.setContainerSize(1000, 600)).toBe(false);
    expect(observedState(controller)).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

});


describe("controller read methods", () => {
  it("keeps render data stable for no-ops and refreshes it before notifying subscribers", () => {
    const controller = createController(props());
    const initial = controller.getLayout();
    expect(initial.panes).toEqual([
      { paneId: "editor", nodeId: "editor-node", active: true, rect: { x: 0, y: 0, width: 1000, height: 600 } },
    ]);
    expect(controller.getLayout()).toBe(initial);
    expect(controller.setContainerSize(1000, 600)).toBe(false);
    expect(controller.getLayout()).toBe(initial);
    const listener = vi.fn(() => {
      expect(controller.getLayout()).not.toBe(initial);
      expect(controller.getLayout().panes[0].rect.width).toBe(800);
    });
    controller.subscribe(listener);
    controller.setContainerSize(800, 600);
    expect(listener).toHaveBeenCalledOnce();
    expect(controller.getLayout()).toBe(controller.getLayout());
    expect(initial.panes[0].rect.width).toBe(1000);
    expect(controller.getLayout()).not.toHaveProperty("root");
  });

  it("invalidates render data for capability changes so subscribed controls update", () => {
    const controller = createController(props());
    const initial = controller.getLayout();
    controller.updatePane("editor", { canRemove: false });
    expect(controller.getLayout()).not.toBe(initial);
    expect(controller.getPane("editor")?.canRemove).toBe(false);
    expect(observedState(controller).root).toMatchObject({ canRemove: false });
  });

  it("returns isolated pane and container data, including normalized defaults", () => {
    const controller = createController({ ...props(), paneDefaults: { canRemove: false } });
    const pane = controller.getPane("editor")!;
    expect(pane).toEqual({ kind: "pane", id: "editor-node", paneId: "editor", canRemove: false });
    pane.canRemove = true;
    expect(controller.getPane("editor")?.canRemove).toBe(false);
    expect(controller.getPane("missing")).toBeNull();
    const container = controller.getContainerSize();
    expect(container).toEqual({ width: 1000, height: 600 });
    container.width = 0;
    expect(controller.getContainerSize().width).toBe(1000);
  });

  it("returns copied drag baselines and reports removed splits and panes", () => {
    const controller = createController(props());
    controller.split("editor-node", { side: "right", newPaneId: "terminal", splitId: "workspace" });
    const sizes = controller.getSplitSizes("workspace")!;
    expect(sizes).toEqual([0.5, 0.5]);
    sizes[0] = 0;
    expect(controller.getSplitSizes("workspace")).toEqual([0.5, 0.5]);
    controller.remove("terminal");
    expect(controller.getPane("terminal")).toBeNull();
    expect(controller.getSplitSizes("workspace")).toBeNull();
    expect(controller.getSplitSizes("editor-node")).toBeNull();
    expect(controller.getLayout().handles).toEqual([]);
  });
});
