import { describe, expect, it } from "vitest";
import type { ComputedPane } from "@focusgrid/core";
import { createPaneMap, diffPaneLifecycle } from "../src/lifecycle";

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
