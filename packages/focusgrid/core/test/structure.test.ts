import { describe, expect, it } from "vitest";
import {
  collectPaneIds,
  FocusGridController,
  findPaneNode,
  findSplitNode,
  paneCommandCapabilityKeys,
  validateFocusGridControllerState,
  type FocusGridControllerState,
} from "../src";
import { computeLayoutGeometry, getMinimumSize } from "../src/layout/geometry";
import { transformLayout, updatePane } from "../src/layout/tree";

function state(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      direction: "horizontal",
      sizes: [1, 1],
      children: [
        { kind: "pane", id: "left-node", paneId: "left", minWidth: 120 },
        { kind: "pane", id: "right-node", paneId: "right", minWidth: 80 },
      ],
    },
    activePaneId: "left",
    container: { width: 403, height: 200 },
  };
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
    expect(findSplitNode(root, "root")).toBe(root);
    expect(findSplitNode(root, "missing")).toBeNull();
  });

  it("uses the rendered split rectangle for minimum-size resize math", () => {
    const current = state();
    const geometry = computeLayoutGeometry(current);
    expect(geometry.rectByNodeId.get("root")).toEqual({
      x: 0,
      y: 0,
      width: 403,
      height: 200,
    });
    expect(geometry.panes.map((pane) => pane.rect.width)).toEqual([200, 200]);
    expect(getMinimumSize(current.root, "horizontal")).toBe(203);
  });
});

describe("canonical pane capabilities", () => {
  it("applies and validates every capability from the shared key set", () => {
    const paneDefaults = Object.fromEntries(
      paneCommandCapabilityKeys.map((key) => [key, false]),
    );
    const controller = new FocusGridController({ ...state(), paneDefaults });
    const firstPane = controller.state.root;
    expect(firstPane.kind).toBe("split");
    if (firstPane.kind !== "split") return;

    for (const key of paneCommandCapabilityKeys) {
      expect(firstPane.children[0]?.kind === "pane" && firstPane.children[0][key]).toBe(false);
    }

    const invalidPane = {
      ...firstPane.children[0],
      canFocus: "yes",
    };
    const result = validateFocusGridControllerState({
      ...controller.state,
      root: { ...firstPane, children: [invalidPane, firstPane.children[1]] },
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContainEqual(
      expect.objectContaining({ code: "invalid-capability", path: "$.root.children[0].canFocus" }),
    );
  });

  it("updates and constructs panes with every capability from the shared key set", () => {
    for (const key of paneCommandCapabilityKeys) {
      const updateController = new FocusGridController(state());
      expect(updateController.updatePane("left", { [key]: false })).toBe(true);
      expect(findPaneNode(updateController.state, "left")?.[key]).toBe(false);

      const splitController = new FocusGridController(state());
      const paneId = splitController.split(findPaneNode(splitController.state, "left")!.id, {
        side: "right",
        newPaneId: `new-${key}`,
        [key]: false,
      });
      expect(paneId).toBe(`new-${key}`);
      expect(findPaneNode(splitController.state, paneId)?.[key]).toBe(false);
    }
  });
});
