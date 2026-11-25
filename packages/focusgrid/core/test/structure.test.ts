import { createController, observedState } from "./observe-controller";
import { describe, expect, it } from "vitest";
import { PaneCommandCapability, validateFocusGridControllerState, type FocusGridControllerState } from "../src";
import { computeLayout } from "../src/layout/geometry";
import { getMinimumSize } from "../src/layout/resize";
import { collectPaneIds, findNode, findPaneNode, transformLayout, updatePane } from "../src/layout/tree";
import { gridState, paneNode, splitNode } from "./layouts";

function state(): FocusGridControllerState {
  return gridState(splitNode("root", "horizontal", [1, 1], [paneNode("left"), paneNode("right")]), "left", {
    width: 403,
    height: 200,
  });
}

describe("shared layout structure", () => {
  it("preserves identity for no-op tree transforms and pane updates", () => {
    const root = state().root;
    expect(transformLayout(root, (node) => node)).toBe(root);
    expect(updatePane(root, "missing", (pane) => ({ ...pane }))).toBe(root);
    expect(updatePane(root, "left", (pane) => pane)).toBe(root);
  });

  it("serves pane and split queries from the canonical tree helpers", () => {
    const root = state().root;
    expect(collectPaneIds(root)).toEqual(["left", "right"]);
    expect(findNode(root, "root")).toBe(root);
    expect(findNode(root, "left-node")).toMatchObject({ paneId: "left" });
    expect(findNode(root, "missing")).toBeNull();
  });

  it("uses the rendered split rectangle for minimum-size resize math", () => {
    const current = state();
    const geometry = computeLayout(current);
    expect(geometry.rectByNodeId.get("root")).toEqual({
      x: 0,
      y: 0,
      width: 403,
      height: 200,
    });
    expect(geometry.panes.map((pane) => pane.rect.width)).toEqual([200, 200]);
    expect(getMinimumSize(current.root, "horizontal", 100)).toBe(203);
  });
});

describe("canonical pane capabilities", () => {
  it("applies and validates every capability from the shared key set", () => {
    const paneDefaults = Object.fromEntries(Object.values(PaneCommandCapability).map((key) => [key, false]));
    const controller = createController({ ...state(), paneDefaults });
    controller.focus("right");
    const firstPane = observedState(controller).root;
    if (firstPane.kind !== "split") throw new Error("Expected a split root.");

    for (const key of Object.values(PaneCommandCapability)) {
      expect(firstPane.children[0]?.kind === "pane" && firstPane.children[0][key]).toBe(false);
    }

    const invalidPane = {
      ...firstPane.children[0],
      canFocus: "yes",
    };
    const result = validateFocusGridControllerState({
      ...observedState(controller),
      root: { ...firstPane, children: [invalidPane, firstPane.children[1]] },
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContainEqual(
      expect.objectContaining({ code: "invalid-capability", path: "$.root.children[0].canFocus" }),
    );
  });

  it("updates and constructs panes with every capability from the shared key set", () => {
    for (const key of Object.values(PaneCommandCapability)) {
      const updateController = createController(state());
      expect(updateController.updatePane("left", { [key]: false })).toBe(true);
      expect(findPaneNode(observedState(updateController).root, "left")?.[key]).toBe(false);

      const splitController = createController(state());
      const paneId = splitController.split(findPaneNode(observedState(splitController).root, "left")!.id, {
        side: "right",
        newPaneId: `new-${key}`,
        [key]: false,
      });
      expect(paneId).toBe(`new-${key}`);
      expect(findPaneNode(observedState(splitController).root, paneId)?.[key]).toBe(false);
    }
  });
});
