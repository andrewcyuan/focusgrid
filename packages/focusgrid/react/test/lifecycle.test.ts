import { describe, expect, it } from "vitest";
import {
  createFocusGridController,
  type ComputedPane,
  type FocusGridControllerState,
} from "@focusgrid/focusgrid/core";
import {
  advancePaneLifecycle,
  createPaneMap,
  diffPaneLifecycle,
} from "../src/lifecycle";

function pane(
  paneId: string,
  rect: ComputedPane["rect"],
  active = false,
): ComputedPane {
  return {
    paneId,
    nodeId: `${paneId}-node`,
    rect,
    active,
  };
}

describe("pane lifecycle diff", () => {
  it("starts fresh lifecycle history when the controller changes", () => {
    const controllerState: FocusGridControllerState = {
      root: { kind: "pane", id: "node", paneId: "editor" },
      activePaneId: "editor",
      container: { width: 100, height: 100 },
    };
    const firstController = createFocusGridController(controllerState);
    const secondController = createFocusGridController(controllerState);
    const first = advancePaneLifecycle(
      null,
      firstController,
      [pane("old", { x: 0, y: 0, width: 100, height: 100 }, true)],
    );
    const second = advancePaneLifecycle(
      first.snapshot,
      secondController,
      [pane("new", { x: 0, y: 0, width: 100, height: 100 }, true)],
    );

    expect(second.diff).toEqual({ layoutChanges: [], closedPanes: [] });
    expect(second.snapshot.controller).toBe(secondController);
  });

  it("reports rect changes for existing panes", () => {
    const previous = createPaneMap([
      pane("editor", { x: 0, y: 0, width: 500, height: 600 }),
    ]);
    const current = createPaneMap([
      pane("editor", { x: 0, y: 0, width: 400, height: 600 }),
    ]);

    expect(diffPaneLifecycle(previous, current)).toEqual({
      layoutChanges: [
        {
          pane: pane("editor", { x: 0, y: 0, width: 400, height: 600 }),
          previousPane: pane("editor", { x: 0, y: 0, width: 500, height: 600 }),
        },
      ],
      closedPanes: [],
    });
  });

  it("does not report active-only changes as layout changes", () => {
    const previous = createPaneMap([
      pane("editor", { x: 0, y: 0, width: 500, height: 600 }, false),
    ]);
    const current = createPaneMap([
      pane("editor", { x: 0, y: 0, width: 500, height: 600 }, true),
    ]);

    expect(diffPaneLifecycle(previous, current)).toEqual({
      layoutChanges: [],
      closedPanes: [],
    });
  });

  it("reports panes that disappear from the layout", () => {
    const previousPane = pane("terminal", {
      x: 500,
      y: 0,
      width: 500,
      height: 600,
    });
    const previous = createPaneMap([
      pane("editor", { x: 0, y: 0, width: 500, height: 600 }),
      previousPane,
    ]);
    const current = createPaneMap([
      pane("editor", { x: 0, y: 0, width: 1000, height: 600 }),
    ]);

    expect(diffPaneLifecycle(previous, current)).toEqual({
      layoutChanges: [
        {
          pane: pane("editor", { x: 0, y: 0, width: 1000, height: 600 }),
          previousPane: pane("editor", { x: 0, y: 0, width: 500, height: 600 }),
        },
      ],
      closedPanes: [{ paneId: "terminal", previousPane }],
    });
  });
});
