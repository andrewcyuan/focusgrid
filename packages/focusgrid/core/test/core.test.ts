import { computeLayout } from "../src/layout/geometry";
import { findPaneInDirection } from "../src/layout/navigation";
import { createController, observedState } from "./observe-controller";
import { gridState, paneNode, splitNode } from "./layouts";
import { describe, expect, it } from "vitest";
import {
  FocusGridController,
  FocusGridStateValidationException,
  validateFocusGridControllerState,
  type PaneCommandCapabilityInput,
  type CardinalDirection,
  type FocusGridControllerState,
} from "../src";

function initialState(): FocusGridControllerState {
  return gridState(paneNode("editor"), "editor");
}

function horizontalSplitState(): FocusGridControllerState {
  return gridState(splitNode("root", "horizontal", [0.5, 0.5], [paneNode("left"), paneNode("right")]), "left");
}

function horizontalSplitWithLeft(capabilities: PaneCommandCapabilityInput): FocusGridControllerState {
  return gridState(
    splitNode("root", "horizontal", [0.5, 0.5], [paneNode("left", capabilities), paneNode("right")]),
    "left",
  );
}

function verticalSplitState(): FocusGridControllerState {
  return gridState(splitNode("root", "vertical", [0.5, 0.5], [paneNode("top"), paneNode("bottom")]), "bottom");
}

function threePaneHorizontalState(
  activePaneId: "left" | "middle" | "right" = "left",
  capabilities: Partial<Record<"left" | "middle" | "right", PaneCommandCapabilityInput>> = {},
): FocusGridControllerState {
  return gridState(
    splitNode(
      "root",
      "horizontal",
      [1 / 3, 2 / 3],
      [
        paneNode("left", capabilities.left),
        splitNode(
          "right-branch",
          "horizontal",
          [0.5, 0.5],
          [paneNode("middle", capabilities.middle), paneNode("right", capabilities.right)],
        ),
      ],
    ),
    activePaneId,
    { width: 900, height: 600 },
  );
}

function leftNestedTrifoldState(): FocusGridControllerState {
  return gridState(
    splitNode(
      "root",
      "horizontal",
      [0.5, 0.5],
      [splitNode("nested", "horizontal", [0.5, 0.5], [paneNode("left"), paneNode("middle")]), paneNode("right")],
    ),
    "middle",
  );
}

function nestedHorizontalState(): FocusGridControllerState {
  return gridState(
    splitNode(
      "root",
      "horizontal",
      [0.5, 0.5],
      [paneNode("left"), splitNode("nested", "horizontal", [0.5, 0.5], [paneNode("middle"), paneNode("right")])],
    ),
    "middle",
  );
}

function nestedHandleState(): FocusGridControllerState {
  return gridState(
    splitNode(
      "root",
      "horizontal",
      [0.25, 0.75],
      [
        splitNode("inner", "horizontal", [0.5, 0.5], [paneNode("inner-left"), paneNode("inner-right")]),
        paneNode("outside"),
      ],
    ),
    "inner-left",
  );
}

function nestedHandleWithPinnedChildState(): FocusGridControllerState {
  return gridState(
    splitNode(
      "root",
      "horizontal",
      [0.75, 0.25],
      [splitNode("inner", "horizontal", [0.8, 0.2], [paneNode("one"), paneNode("two")]), paneNode("three")],
    ),
    "three",
    { width: 1300, height: 600 },
  );
}

function nestedDirectionalFocusState(): FocusGridControllerState {
  return gridState(
    splitNode(
      "root",
      "horizontal",
      [0.5, 0.5],
      [
        paneNode("left"),
        splitNode("right-split", "vertical", [0.25, 0.75], [paneNode("upper-right"), paneNode("lower-right")]),
      ],
    ),
    "left",
  );
}

function verticalMiddleTrifoldState(): FocusGridControllerState {
  const middle = splitNode(
    "middle-split",
    "vertical",
    [0.25, 0.75],
    [paneNode("middle-top"), paneNode("middle-bottom")],
  );
  return gridState(
    splitNode(
      "root",
      "horizontal",
      [0.75, 0.25],
      [splitNode("left-branch", "horizontal", [1 / 3, 2 / 3], [paneNode("left"), middle]), paneNode("right")],
    ),
    "middle-bottom",
    { width: 1200, height: 600 },
  );
}

function horizontalTargetWithStaleMemoryState(): FocusGridControllerState {
  const target = {
    ...splitNode("right-split", "horizontal", [0.5, 0.5], [paneNode("near"), paneNode("far")]),
    lastFocusedChildId: "far-node",
  };
  return gridState(splitNode("root", "horizontal", [0.3, 0.7], [paneNode("left"), target]), "left");
}

function focusDirection(controller: FocusGridController, paneId: string, direction: CardinalDirection): boolean {
  const target = findPaneInDirection(observedState(controller).root, controller.getLayout(), paneId, direction);
  return target !== null && controller.focus(target);
}

function rootSizes(controller: FocusGridController): number[] {
  const root = observedState(controller).root;
  if (root.kind !== "split") throw new Error("Expected a split root.");
  return root.sizes;
}

function nestedSizes(controller: FocusGridController, childIndex: number): number[] {
  const root = observedState(controller).root;
  const child = root.kind === "split" ? root.children[childIndex] : undefined;
  if (child?.kind !== "split") throw new Error("Expected a nested split.");
  return child.sizes;
}

describe("state validation", () => {
  it("accepts a valid public controller state", () => {
    const state = initialState();
    expect(validateFocusGridControllerState(state)).toEqual({ ok: true, state, errors: [] });
  });

  it("rejects invalid tree shapes and unknown structural fields", () => {
    const result = validateFocusGridControllerState({
      ...initialState(),
      root: { ...paneNode("editor"), theme: "dark" },
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContainEqual(
      expect.objectContaining({ code: "unknown-field", path: "$.root.theme", nodeId: "editor-node", paneId: "editor" }),
    );
  });

  it("rejects duplicate IDs, missing active panes, and non-binary splits", () => {
    const result = validateFocusGridControllerState({
      root: {
        kind: "split",
        id: "root",
        orientation: "horizontal",
        sizes: [1 / 3, 1 / 3, 1 / 3],
        children: [
          { kind: "pane", id: "pane-node", paneId: "same" },
          { kind: "pane", id: "pane-node", paneId: "same" },
          { kind: "pane", id: "third-node", paneId: "third" },
        ],
      },
      activePaneId: "missing",
      container: { width: 1000, height: 600 },
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "non-binary-split" }),
        expect.objectContaining({ code: "invalid-sizes" }),
        expect.objectContaining({ code: "duplicate-node-id" }),
        expect.objectContaining({ code: "duplicate-pane-id" }),
        expect.objectContaining({ code: "unknown-active-pane", paneId: "missing" }),
      ]),
    );
  });

  it("rejects bad sizes, min sizes, capability types, and legacy no* fields", () => {
    const result = validateFocusGridControllerState({
      root: {
        kind: "split",
        id: "root",
        orientation: "sideways",
        sizes: [Number.NaN, -1],
        children: [
          { kind: "pane", id: "left-node", paneId: "left", minWidth: -1, canRemove: "yes", noFocus: true },
          { kind: "pane", id: "right-node", paneId: "right" },
        ],
        lastFocusedChildId: "missing-node",
      },
      activePaneId: "left",
      container: { width: Number.POSITIVE_INFINITY, height: 600 },
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-direction" }),
        expect.objectContaining({ code: "invalid-size", path: "$.root.sizes[0]" }),
        expect.objectContaining({ code: "invalid-size", path: "$.root.sizes[1]" }),
        expect.objectContaining({ code: "unknown-field", path: "$.root.children[0].minWidth" }),
        expect.objectContaining({ code: "invalid-capability", paneId: "left" }),
        expect.objectContaining({ code: "unknown-field", path: "$.root.children[0].noFocus", paneId: "left" }),
        expect.objectContaining({ code: "invalid-last-focused-child" }),
        expect.objectContaining({ code: "invalid-number", path: "$.container.width" }),
      ]),
    );
  });

  it("rejects removed pane data and minimum fields", () => {
    for (const field of ["data", "minWidth", "minHeight"]) {
      const state = initialState();
      const result = validateFocusGridControllerState({ ...state, root: { ...state.root, [field]: 1 } });
      expect(result.ok).toBe(false);
      expect(result.ok ? [] : result.errors).toContainEqual(
        expect.objectContaining({ code: "unknown-field", path: `$.root.${field}` }),
      );
    }
  });

  it("throws validation exceptions during controller creation", () => {
    expect(() => createController({ ...initialState(), activePaneId: "missing" })).toThrow(
      FocusGridStateValidationException,
    );
  });
});

describe("split", () => {
  it("splits panes and computes rectangles", () => {
    const controller = createController(initialState());
    controller.split("editor-node", { side: "right", newPaneId: "terminal" });

    const state = observedState(controller);
    const layout = computeLayout(state);
    expect(state.root.kind).toBe("split");
    expect(state.activePaneId).toBe("terminal");
    expect(layout.panes).toHaveLength(2);
    expect(layout.handles).toHaveLength(1);
    expect(layout.panes[0]!.rect.width + layout.panes[1]!.rect.width + layout.handles[0]!.rect.width).toBe(1000);
  });

  it.each([
    ["right", "horizontal", ["editor", "added"]],
    ["left", "horizontal", ["added", "editor"]],
    ["down", "vertical", ["editor", "added"]],
    ["up", "vertical", ["added", "editor"]],
  ] as const)("places a %s split", (side, orientation, order) => {
    const controller = createController(initialState());
    expect(controller.split("editor-node", { side, newPaneId: "added" })).toBe("added");
    expect(observedState(controller).activePaneId).toBe("added");
    expect(observedState(controller).root).toMatchObject({
      kind: "split",
      orientation,
      children: order.map((paneId) => ({ paneId })),
    });
  });

  it("returns generated split pane ids and can preserve the active pane", () => {
    const generated = createController(initialState());
    const newPaneId = generated.split("editor-node", { side: "right" });
    expect(newPaneId).toEqual(expect.stringMatching(/^pane-/));
    expect(observedState(generated).activePaneId).toBe(newPaneId);
    expect(computeLayout(observedState(generated)).panes.map((pane) => pane.paneId)).toContain(newPaneId);

    const preserved = createController(initialState());
    expect(preserved.split("editor-node", { side: "right", newPaneId: "terminal", preserveActivePane: true })).toBe(
      "terminal",
    );
    expect(observedState(preserved).activePaneId).toBe("editor");
  });

  it("splits when there is no active pane without inventing focus memory", () => {
    const controller = createController({ ...initialState(), activePaneId: null });
    expect(controller.split("editor-node", { side: "right", newPaneId: "terminal", preserveActivePane: true })).toBe(
      "terminal",
    );
    expect(observedState(controller).activePaneId).toBeNull();
    expect(observedState(controller).root).toMatchObject({
      kind: "split",
      orientation: "horizontal",
      children: [{ paneId: "editor" }, { paneId: "terminal" }],
    });
  });

  it("applies configured default minimum pane dimensions", () => {
    const controller = createController({ ...initialState(), minWidth: 300, minHeight: 200 });
    expect(controller.minWidth).toBe(300);
    expect(controller.minHeight).toBe(200);
    expect(observedState(controller).root).toMatchObject({ kind: "pane", paneId: "editor" });

    expect(controller.split("editor-node", { side: "right", newPaneId: "terminal" })).toBe("terminal");
    expect(observedState(controller).root).toMatchObject({
      kind: "split",
      children: [{ paneId: "editor" }, { paneId: "terminal" }],
    });

    expect(controller.resize("editor", { direction: "right", deltaPx: -400 })).toBe(true);
    expect(rootSizes(controller)[0]).toBeCloseTo(0.3);
    expect(controller.resize("editor", { direction: "right", deltaPx: -1 })).toBe(false);
    const editorPane = computeLayout(observedState(controller)).panes.find((pane) => pane.paneId === "editor");
    expect(editorPane?.rect.width).toBeLessThan(500);
  });

  it("refuses splits that would make either pane smaller than the minimum size", () => {
    const controller = createController({ ...initialState(), minWidth: 300, minHeight: 250 });
    const first = controller.splitActive("right")!;
    expect(controller.splitActive("right")).toBeNull();
    expect(observedState(controller).activePaneId).toBe(first);
    expect(controller.splitActive("down")).not.toBeNull();
    expect(controller.splitActive("down")).toBeNull();
    for (const pane of computeLayout(observedState(controller)).panes) {
      expect(pane.rect.width).toBeGreaterThanOrEqual(300);
      expect(pane.rect.height).toBeGreaterThanOrEqual(250);
    }
  });

  it("applies pane capability defaults and lets explicit true override them", () => {
    const controller = createController({
      ...horizontalSplitWithLeft({ canRemove: true, canFocus: true }),
      paneDefaults: { canRemove: false, canResizeX: false, canFocus: false },
    });

    controller.focus("left");
    expect(observedState(controller).root).toMatchObject({
      kind: "split",
      children: [
        { paneId: "left", canRemove: true, canResizeX: false, canFocus: true },
        { paneId: "right", canRemove: false, canResizeX: false, canFocus: false },
      ],
    });

    expect(
      controller.split("left-node", { side: "right", newPaneId: "explicit", canRemove: true, canFocus: true }),
    ).toBe("explicit");
    expect(observedState(controller).root).toMatchObject({
      kind: "split",
      children: [
        {
          kind: "split",
          children: [{ paneId: "left" }, { paneId: "explicit", canRemove: true, canResizeX: false, canFocus: true }],
        },
        { paneId: "right" },
      ],
    });
  });
});

describe("remove", () => {
  it("removes panes, collapses single-child splits, and refuses the last pane", () => {
    const collapsed = createController(initialState());
    collapsed.split("editor-node", { side: "right", newPaneId: "terminal" });
    collapsed.remove("terminal");
    expect(observedState(collapsed).root.kind).toBe("pane");
    expect(observedState(collapsed).activePaneId).toBe("editor");

    const removeActive = createController(horizontalSplitState());
    expect(removeActive.remove("left")).toBe(true);
    expect(observedState(removeActive).root).toMatchObject({ kind: "pane", paneId: "right" });
    expect(observedState(removeActive).activePaneId).toBe("right");

    const removeInactive = createController(horizontalSplitState());
    expect(removeInactive.remove("right")).toBe(true);
    expect(observedState(removeInactive).activePaneId).toBe("left");

    const missing = createController(horizontalSplitState());
    const beforeMissing = observedState(missing);
    expect(missing.remove("missing")).toBe(false);
    expect(observedState(missing)).toBe(beforeMissing);

    const last = createController(initialState());
    expect(last.remove("editor")).toBe(false);
    expect(observedState(last).activePaneId).toBe("editor");
  });

  it("ignores stale split focus memory after a remembered pane is closed", () => {
    const controller = createController(verticalMiddleTrifoldState());
    controller.focus("middle-top");
    expect(controller.remove("middle-top")).toBe(true);
    focusDirection(controller, "left", "right");
    expect(observedState(controller).activePaneId).toBe("middle-bottom");
  });
});

describe("swap", () => {
  it("swaps pane content while preserving layout slots and the active pane", () => {
    const controller = createController(
      gridState(splitNode("root", "horizontal", [0.25, 0.75], [paneNode("left"), paneNode("right")]), "left"),
    );
    expect(controller.swap("left", "right")).toBe(true);

    const state = observedState(controller);
    expect(state.activePaneId).toBe("left");
    expect(state.root).toMatchObject({
      kind: "split",
      sizes: [0.25, 0.75],
      children: [
        { kind: "pane", id: "left-node", paneId: "right" },
        { kind: "pane", id: "right-node", paneId: "left" },
      ],
    });

    const layout = computeLayout(state);
    const leftPane = layout.panes.find((pane) => pane.paneId === "left");
    const rightPane = layout.panes.find((pane) => pane.paneId === "right");
    expect(leftPane?.active).toBe(true);
    expect(leftPane!.rect.x).toBeGreaterThan(rightPane!.rect.x);
  });

  it("returns false and preserves state when controller.swap cannot swap", () => {
    for (const [first, second] of [
      ["left", "left"],
      ["left", "missing"],
      ["missing", "right"],
      ["missing-a", "missing-b"],
    ]) {
      const controller = createController(horizontalSplitState());
      const before = observedState(controller);
      expect(controller.swap(first!, second!)).toBe(false);
      expect(observedState(controller)).toBe(before);
    }
  });

  it("updates split focus memory after swapping the active pane", () => {
    const controller = createController(nestedHorizontalState());
    controller.swap("left", "middle");
    const next = observedState(controller);
    expect(next.activePaneId).toBe("middle");
    expect(next.root.kind === "split" && next.root.lastFocusedChildId).toBe("left-node");
  });

  it("swaps panes with the direct horizontal and vertical directional neighbors", () => {
    const horizontal = createController(horizontalSplitState());
    expect(horizontal.swapAdjacent("right")).toBe(true);
    expect(observedState(horizontal).activePaneId).toBe("left");
    expect(observedState(horizontal).root).toMatchObject({
      children: [
        { id: "left-node", paneId: "right" },
        { id: "right-node", paneId: "left" },
      ],
    });

    const vertical = createController(verticalSplitState());
    expect(vertical.swapAdjacent("up")).toBe(true);
    expect(observedState(vertical).activePaneId).toBe("bottom");
    expect(observedState(vertical).root).toMatchObject({
      children: [
        { id: "top-node", paneId: "bottom" },
        { id: "bottom-node", paneId: "top" },
      ],
    });
  });

  it("directional swap selects the remembered pane in a nested branch", () => {
    const controller = createController(verticalMiddleTrifoldState());
    controller.focus("left");
    expect(findPaneInDirection(observedState(controller).root, controller.getLayout(), "left", "right")).toBe(
      "middle-bottom",
    );
    expect(controller.swapAdjacent("right")).toBe(true);

    const swapped = observedState(controller);
    expect(swapped.activePaneId).toBe("left");
    expect(swapped.root).toMatchObject({
      children: [
        {
          kind: "split",
          children: [
            { id: "left-node", paneId: "middle-bottom" },
            {
              kind: "split",
              children: [
                { id: "middle-top-node", paneId: "middle-top" },
                { id: "middle-bottom-node", paneId: "left" },
              ],
            },
          ],
        },
        { paneId: "right" },
      ],
    });
  });

  it("directional swap preserves split structure and sizes", () => {
    const controller = createController(nestedDirectionalFocusState());
    controller.focus("left");
    expect(controller.swapAdjacent("right")).toBe(true);
    expect(observedState(controller).root).toMatchObject({
      id: "root",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
      children: [{}, { kind: "split", id: "right-split", orientation: "vertical", sizes: [0.25, 0.75] }],
    });
  });

  it("blocks default directional swap when active or target pane disallows the axis", () => {
    const unchangedRoot = {
      kind: "split",
      children: [{ paneId: "left" }, { kind: "split", children: [{ paneId: "middle" }, { paneId: "right" }] }],
    };
    for (const capabilities of [{ left: { canSwapX: false } }, { middle: { canSwapX: false } }]) {
      const controller = createController(threePaneHorizontalState("left", capabilities));
      expect(controller.swapAdjacent("right")).toBe(false);
      expect(observedState(controller).root).toMatchObject(unchangedRoot);
    }
  });
});

describe("resize", () => {
  it("resizes a handle from a snapshot", () => {
    const controller = createController(initialState());
    controller.split("editor-node", { side: "right", newPaneId: "terminal" });
    const split = observedState(controller).root;
    controller.resizeHandle(split.id, { index: 0, deltaPx: 100, snapshotSizes: [0.5, 0.5] });

    expect(rootSizes(controller)[0]).toBeCloseTo(0.6);
    expect(rootSizes(controller)[1]).toBeCloseTo(0.4);
  });

  it.each([
    ["left", "left", 100, 0.4],
    ["left", "right", 100, 0.6],
    ["right", "right", 100, 0.6],
    ["right", "left", 100, 0.4],
    ["top", "up", 60, 0.4],
    ["top", "down", 60, 0.6],
    ["bottom", "down", 60, 0.6],
    ["bottom", "up", 60, 0.4],
  ] as const)("resizes edge pane %s %s by moving its sibling boundary", (paneId, direction, deltaPx, firstSize) => {
    const state = paneId === "left" || paneId === "right" ? horizontalSplitState() : verticalSplitState();
    const controller = createController(state);
    expect(controller.resize(paneId, { direction, deltaPx })).toBe(true);
    expect(rootSizes(controller)[0]).toBeCloseTo(firstSize);
    expect(rootSizes(controller)[1]).toBeCloseTo(1 - firstSize);
  });

  it.each([
    ["left", leftNestedTrifoldState, "left", 0, [0.298793, 0.701207]],
    ["left", leftNestedTrifoldState, "right", 0, [0.701207, 0.298793]],
    ["right", nestedHorizontalState, "right", 1, [0.701207, 0.298793]],
    ["right", nestedHorizontalState, "left", 1, [0.298793, 0.701207]],
  ] as const)(
    "resizes a middle pane against the %s sibling boundary toward %s",
    (_, createState, direction, nestedIndex, expected) => {
      const controller = createController(createState());
      controller.resize("middle", { direction, deltaPx: 100 });
      expect(rootSizes(controller)).toEqual([0.5, 0.5]);
      expect(nestedSizes(controller, nestedIndex)[0]).toBeCloseTo(expected[0]);
      expect(nestedSizes(controller, nestedIndex)[1]).toBeCloseTo(expected[1]);
    },
  );

  it("clamps pane resize to adjacent minimum sizes", () => {
    const controller = createController({ ...horizontalSplitState(), minWidth: 400 });
    controller.resize("left", { direction: "right", deltaPx: 300 });
    expect(rootSizes(controller)[0]).toBeCloseTo(0.6);
    expect(rootSizes(controller)[1]).toBeCloseTo(0.4);
  });

  it("uses the target split axis size for nested handle resize", () => {
    const controller = createController(nestedHandleState());
    controller.resizeHandle("inner", { index: 0, deltaPx: 24, snapshotSizes: [0.5, 0.5] });
    expect(nestedSizes(controller, 0)[0]).toBeCloseTo(0.596774);
    expect(nestedSizes(controller, 0)[1]).toBeCloseTo(0.403226);
  });

  it("refits nested split sizes when resizing a parent handle", () => {
    const controller = createController({ ...nestedHandleWithPinnedChildState(), minWidth: 180 });
    const widthOf = (paneId: string) =>
      computeLayout(observedState(controller)).panes.find((pane) => pane.paneId === paneId)!.rect.width;
    const before = { one: widthOf("one"), two: widthOf("two"), three: widthOf("three") };
    expect(before.two).toBeGreaterThanOrEqual(180);

    expect(controller.resizeHandle("root", { index: 0, deltaPx: -100, snapshotSizes: [0.75, 0.25] })).toBe(true);

    expect(rootSizes(controller)[0]).toBeCloseTo(0.673077);
    expect(rootSizes(controller)[1]).toBeCloseTo(0.326923);
    expect(widthOf("three")).toBeGreaterThan(before.three);
    expect(widthOf("two")).toBeGreaterThanOrEqual(180);
    expect(widthOf("two")).toBeGreaterThanOrEqual(before.two - 20);
    expect(widthOf("one")).toBeLessThan(before.one);
  });

  it("resizes the active pane by a fixed step", () => {
    const controller = createController(horizontalSplitState());
    expect(controller.resizeActive("right", 48)).toBe(true);
    expect(rootSizes(controller)[0]).toBeCloseTo(0.548);
    expect(rootSizes(controller)[1]).toBeCloseTo(0.452);
  });

  it("returns false and preserves state for no-op controller.resize calls", () => {
    const cases: [FocusGridControllerState, string, CardinalDirection, number][] = [
      [horizontalSplitState(), "left", "right", 0],
      [horizontalSplitState(), "left", "up", 100],
      [horizontalSplitState(), "missing", "right", 100],
      [{ ...horizontalSplitState(), container: { width: 0, height: 600 } }, "left", "right", 100],
    ];
    for (const [state, paneId, direction, deltaPx] of cases) {
      const controller = createController(state);
      const before = observedState(controller);
      expect(controller.resize(paneId, { direction, deltaPx })).toBe(false);
      expect(observedState(controller)).toBe(before);
    }
  });

  it("treats negative controller.resize deltas as inverse movement", () => {
    const controller = createController(horizontalSplitState());
    expect(controller.resize("left", { direction: "right", deltaPx: -100 })).toBe(true);
    expect(rootSizes(controller)[0]).toBeCloseTo(0.4);
    expect(rootSizes(controller)[1]).toBeCloseTo(0.6);
  });
});

describe("pane capabilities", () => {
  it("blocks active-pane split, remove, and resize commands with pane capabilities", () => {
    const cases: [PaneCommandCapabilityInput, (controller: FocusGridController) => unknown, unknown][] = [
      [{ canSplitHorizontal: false }, (controller) => controller.splitActive("right"), null],
      [{ canSplitVertical: false }, (controller) => controller.splitActive("down"), null],
      [{ canRemove: false }, (controller) => controller.removeActive(), false],
      [{ canResizeX: false }, (controller) => controller.resizeActive("right", 48), false],
    ];
    for (const [capabilities, command, blockedResult] of cases) {
      const controller = createController(horizontalSplitWithLeft(capabilities));
      const before = observedState(controller);
      expect(command(controller)).toBe(blockedResult);
      expect(observedState(controller)).toBe(before);
    }
  });

  it("keeps direct controller calls unaffected by pane capabilities", () => {
    const controller = createController(
      horizontalSplitWithLeft({ canRemove: false, canResizeX: false, canSplitHorizontal: false, canFocus: false }),
    );
    expect(controller.resize("left", { direction: "right", deltaPx: 48 })).toBe(true);
    expect(controller.focus("right")).toBe(true);
    expect(controller.focus("left")).toBe(true);
    expect(controller.split("right-node", { side: "right", newPaneId: "extra" })).toBe("extra");
    expect(controller.remove("left")).toBe(true);
  });

  it("updates pane command capabilities through controller", () => {
    const controller = createController(horizontalSplitState());
    expect(controller.updatePane("left", { canResizeX: false, canFocus: false })).toBe(true);
    expect(observedState(controller).root).toMatchObject({
      children: [{ paneId: "left", canResizeX: false, canFocus: false }, { paneId: "right" }],
    });
    expect(controller.updatePane("left", { canResizeX: true })).toBe(true);
    expect(observedState(controller).root).toMatchObject({
      children: [{ paneId: "left", canResizeX: true, canFocus: false }, { paneId: "right" }],
    });
    expect(controller.updatePane("missing", { canFocus: false })).toBe(false);
  });

  it("keeps resize and swap capabilities scoped to their axis", () => {
    const resize = createController(
      gridState(
        splitNode("root", "vertical", [0.5, 0.5], [paneNode("top", { canResizeX: false }), paneNode("bottom")]),
        "top",
      ),
    );
    expect(resize.resizeActive("down", 48)).toBe(true);
    expect(rootSizes(resize)[0]).toBeGreaterThan(0.5);

    const swap = createController(
      gridState(
        splitNode("root", "vertical", [0.5, 0.5], [paneNode("top", { canSwapX: false }), paneNode("bottom")]),
        "top",
      ),
    );
    expect(swap.swapAdjacent("down")).toBe(true);
    expect(observedState(swap).root).toMatchObject({ children: [{ paneId: "bottom" }, { paneId: "top" }] });
  });
});

describe("focus", () => {
  it("keeps directional focus on focusAdjacent instead of a focusDirection method", () => {
    const controller = createController(horizontalSplitState());
    expect("focusDirection" in controller).toBe(false);
    expect(controller.focusAdjacent("right")).toBe(true);
    expect(observedState(controller).activePaneId).toBe("right");
  });

  it("returns false and preserves state for no-op controller.focus calls", () => {
    for (const paneId of ["editor", "missing"]) {
      const controller = createController(initialState());
      const before = observedState(controller);
      expect(controller.focus(paneId)).toBe(false);
      expect(observedState(controller)).toBe(before);
    }

    const noActivePane = createController({ ...initialState(), activePaneId: null });
    expect(noActivePane.focus("editor")).toBe(true);
    expect(observedState(noActivePane).activePaneId).toBe("editor");
  });

  it("focuses horizontally and vertically adjacent panes", () => {
    const horizontal = createController(horizontalSplitState());
    focusDirection(horizontal, "left", "right");
    expect(observedState(horizontal).activePaneId).toBe("right");
    focusDirection(horizontal, "right", "left");
    expect(observedState(horizontal).activePaneId).toBe("left");

    const vertical = createController(verticalSplitState());
    focusDirection(vertical, "bottom", "up");
    expect(observedState(vertical).activePaneId).toBe("top");
    focusDirection(vertical, "top", "down");
    expect(observedState(vertical).activePaneId).toBe("bottom");
  });

  it("chooses the closest edge pane in a nested directional sibling", () => {
    const controller = createController(nestedDirectionalFocusState());
    focusDirection(controller, "left", "right");
    expect(observedState(controller).activePaneId).toBe("lower-right");
  });

  it("remembers the last focused pane inside an ambiguous directional split", () => {
    const controller = createController(verticalMiddleTrifoldState());
    controller.focus("middle-top");
    focusDirection(controller, "middle-top", "left");
    focusDirection(controller, "left", "right");
    expect(observedState(controller).activePaneId).toBe("middle-top");

    controller.focus("middle-bottom");
    focusDirection(controller, "middle-bottom", "right");
    focusDirection(controller, "right", "left");
    expect(observedState(controller).activePaneId).toBe("middle-bottom");
  });

  it("keeps the closest entering edge ahead of remembered split focus", () => {
    const controller = createController(horizontalTargetWithStaleMemoryState());
    focusDirection(controller, "left", "right");
    expect(observedState(controller).activePaneId).toBe("near");
  });

  it("marks a newly split pane as focused in split memory", () => {
    const controller = createController(verticalMiddleTrifoldState());
    controller.split("middle-top-node", { side: "down", newPaneId: "middle-top-bottom" });
    focusDirection(controller, "middle-top-bottom", "left");
    focusDirection(controller, "left", "right");
    expect(observedState(controller).activePaneId).toBe("middle-top-bottom");
  });

  it("uses nested split memory when geometry would pick another pane in the branch", () => {
    const controller = createController(verticalMiddleTrifoldState());
    controller.split("middle-top-node", { side: "down", newPaneId: "middle-top-bottom" });
    controller.focus("middle-top");
    focusDirection(controller, "middle-top", "left");
    focusDirection(controller, "left", "right");
    expect(observedState(controller).activePaneId).toBe("middle-top");
  });

  it("returns null when no directional sibling matches", () => {
    const state = horizontalSplitState();
    expect(findPaneInDirection(state.root, computeLayout(state), "left", "left")).toBeNull();
  });

  it("skips canFocus false panes for focusAdjacent", () => {
    const controller = createController(threePaneHorizontalState("left", { middle: { canFocus: false } }));
    expect(controller.focusAdjacent("right")).toBe(true);
    expect(observedState(controller).activePaneId).toBe("right");

    const allBlocked = createController(
      threePaneHorizontalState("left", { middle: { canFocus: false }, right: { canFocus: false } }),
    );
    expect(allBlocked.focusAdjacent("right")).toBe(false);
    expect(observedState(allBlocked).activePaneId).toBe("left");
  });

  it("wraps directional focus only when overflow is enabled", () => {
    const blocked = createController(threePaneHorizontalState("right"));
    expect(blocked.focusAdjacent("right")).toBe(false);
    expect(observedState(blocked).activePaneId).toBe("right");

    const wrapping = createController({ ...threePaneHorizontalState("right"), directionalFocusOverflow: true });
    expect(wrapping.focusAdjacent("right")).toBe(true);
    expect(observedState(wrapping).activePaneId).toBe("left");
  });

  it("applies focus capabilities during overflow search and never refocuses active pane", () => {
    const controller = createController({
      ...threePaneHorizontalState("right", { left: { canFocus: false } }),
      directionalFocusOverflow: true,
    });
    expect(controller.focusAdjacent("right")).toBe(true);
    expect(observedState(controller).activePaneId).toBe("middle");

    const allBlocked = createController({
      ...threePaneHorizontalState("right", { left: { canFocus: false }, middle: { canFocus: false } }),
      directionalFocusOverflow: true,
    });
    expect(allBlocked.focusAdjacent("right")).toBe(false);
    expect(observedState(allBlocked).activePaneId).toBe("right");
  });
});
