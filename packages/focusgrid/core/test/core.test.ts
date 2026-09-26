import { describe, expect, it } from "vitest";
import {
  computeLayout,
  findPaneNode,
  createDefaultPaneKeymap,
  createDefaultPaneShortcuts,
  FocusGridController,
  defaultPaneShortcutActions,
  deserializeFocusGridControllerState,
  FocusGridStateValidationException,
  validateFocusGridControllerState,
  type PaneCommandCapabilityInput,
  type CardinalDirection,
  type FocusGridControllerState,
} from "../src";

import { findPaneInDirection } from "../src/layout/navigation";

function initialState(): FocusGridControllerState {
  return {
    root: {
      kind: "pane",
      id: "node-1",
      paneId: "editor",
    },
    activePaneId: "editor",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

function focusDirection(
  controller: FocusGridController,
  paneId: string,
  direction: CardinalDirection,
): boolean {
  const target = findPaneInDirection(controller.state, paneId, direction);

  return target !== null && controller.focus(target);
}

describe("state validation", () => {
  it("accepts a valid public controller state", () => {
    const state = initialState();
    const result = validateFocusGridControllerState(state);

    expect(result).toEqual({
      ok: true,
      state,
      errors: [],
    });
  });

  it("rejects invalid tree shapes and unknown structural fields", () => {
    const result = validateFocusGridControllerState({
      ...initialState(),
      root: {
        kind: "pane",
        id: "node-1",
        paneId: "editor",
        theme: "dark",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContainEqual(
      expect.objectContaining({
        code: "unknown-field",
        path: "$.root.theme",
        nodeId: "node-1",
        paneId: "editor",
      }),
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
      container: {
        width: 1000,
        height: 600,
      },
    });

    expect(result.ok).toBe(false);
    const errors = result.ok ? [] : result.errors;
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "non-binary-split" }),
        expect.objectContaining({ code: "invalid-sizes" }),
        expect.objectContaining({ code: "duplicate-node-id" }),
        expect.objectContaining({ code: "duplicate-pane-id" }),
        expect.objectContaining({
          code: "unknown-active-pane",
          paneId: "missing",
        }),
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
          {
            kind: "pane",
            id: "left-node",
            paneId: "left",
            minWidth: -1,
            canRemove: "yes",
            noFocus: true,
          },
          {
            kind: "pane",
            id: "right-node",
            paneId: "right",
          },
        ],
        lastFocusedChildId: "missing-node",
      },
      activePaneId: "left",
      container: {
        width: Number.POSITIVE_INFINITY,
        height: 600,
      },
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

  it("throws validation exceptions during controller creation and deserialize", () => {
    expect(() =>
      new FocusGridController({
        ...initialState(),
        activePaneId: "missing",
      }),
    ).toThrow(FocusGridStateValidationException);

    expect(() =>
      deserializeFocusGridControllerState(
        JSON.stringify({
          ...initialState(),
          root: {
            kind: "pane",
            id: "node-1",
            paneId: "editor",
            noRemove: true,
          },
        }),
      ),
    ).toThrow(FocusGridStateValidationException);

    try {
      deserializeFocusGridControllerState("{");
      throw new Error("expected invalid JSON to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(FocusGridStateValidationException);
      expect((error as FocusGridStateValidationException).errors).toEqual([
        expect.objectContaining({ code: "invalid-json", path: "$" }),
      ]);
    }
  });
});

describe("controller", () => {
  it("splits panes and computes rectangles", () => {
    const controller = new FocusGridController(initialState());

    controller.split(findPaneNode(controller.state.root, "editor")!.id, { side: "right", newPaneId: "terminal" });

    const state = controller.state;
    const layout = computeLayout(controller.state);

    expect(state.root.kind).toBe("split");
    expect(state.activePaneId).toBe("terminal");
    expect(layout.panes).toHaveLength(2);
    expect(layout.handles).toHaveLength(1);
    expect(
      layout.panes[0]!.rect.width +
        layout.panes[1]!.rect.width +
        layout.handles[0]!.rect.width,
    ).toBe(1000);
  });

  it("exposes scriptable split placement through controller", () => {
    const right = new FocusGridController(initialState());
    expect(
      right.split(findPaneNode(right.state.root, "editor")!.id, {
        side: "right",
        newPaneId: "terminal",
      }),
    ).toBe("terminal");
    expect(right.state.activePaneId).toBe("terminal");
    expect(right.state.root).toMatchObject({
      kind: "split",
      orientation: "horizontal",
      children: [{ paneId: "editor" }, { paneId: "terminal" }],
    });

    const left = new FocusGridController(initialState());
    expect(left.split(findPaneNode(left.state.root, "editor")!.id, { side: "left", newPaneId: "nav" })).toBe(
      "nav",
    );
    expect(left.state.root).toMatchObject({
      kind: "split",
      orientation: "horizontal",
      children: [{ paneId: "nav" }, { paneId: "editor" }],
    });

    const down = new FocusGridController(initialState());
    expect(
      down.split(findPaneNode(down.state.root, "editor")!.id, { side: "down", newPaneId: "console" }),
    ).toBe("console");
    expect(down.state.root).toMatchObject({
      kind: "split",
      orientation: "vertical",
      children: [{ paneId: "editor" }, { paneId: "console" }],
    });

    const up = new FocusGridController(initialState());
    expect(up.split(findPaneNode(up.state.root, "editor")!.id, { side: "up", newPaneId: "search" })).toBe(
      "search",
    );
    expect(up.state.root).toMatchObject({
      kind: "split",
      orientation: "vertical",
      children: [{ paneId: "search" }, { paneId: "editor" }],
    });
  });

  it("returns generated split pane ids and can preserve the active pane", () => {
    const generated = new FocusGridController(initialState());
    const newPaneId = generated.split(findPaneNode(generated.state.root, "editor")!.id, { side: "right" });

    expect(newPaneId).toEqual(expect.stringMatching(/^pane-/));
    expect(generated.state.activePaneId).toBe(newPaneId);
    expect(
      computeLayout(generated.state).panes.map((pane) => pane.paneId),
    ).toContain(newPaneId);

    const preserved = new FocusGridController(initialState());
    expect(
      preserved.split(findPaneNode(preserved.state.root, "editor")!.id, {
        side: "right",
        newPaneId: "terminal",
        preserveActivePane: true,
      }),
    ).toBe("terminal");
    expect(preserved.state.activePaneId).toBe("editor");
  });

  it("rejects removed pane data and minimum fields", () => {
    for (const field of ["data", "minWidth", "minHeight"]) {
      const state = initialState();
      const result = validateFocusGridControllerState({ ...state, root: { ...state.root, [field]: 1 } });
      expect(result.ok).toBe(false);
      expect(result.ok ? [] : result.errors).toContainEqual(expect.objectContaining({ code: "unknown-field", path: `$.root.${field}` }));
    }
  });

  it("applies configured default minimum pane dimensions", () => {
    const controller = new FocusGridController({
      root: {
        kind: "pane",
        id: "node-1",
        paneId: "editor",
      },
      activePaneId: "editor",
      container: {
        width: 1000,
        height: 600,
      },
      minWidth: 300,
      minHeight: 200,
    });

    expect(controller.minWidth).toBe(300);
    expect(controller.minHeight).toBe(200);
    expect(controller.state.root).toMatchObject({
      kind: "pane",
      paneId: "editor",
    });

    expect(
      controller.split(findPaneNode(controller.state.root, "editor")!.id, {
        side: "right",
        newPaneId: "terminal",
      }),
    ).toBe("terminal");
    expect(controller.state.root).toMatchObject({
      kind: "split",
      children: [
        { paneId: "editor" },
        { paneId: "terminal" },
      ],
    });

    expect(
      controller.resize("editor", { direction: "right", deltaPx: -400 }),
    ).toBe(true);

    const root = controller.state.root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.3);
    expect(
      controller.resize("editor", { direction: "right", deltaPx: -1 }),
    ).toBe(false);

    const editorPane = computeLayout(controller.state)
      .panes.find((pane) => pane.paneId === "editor");
    expect(editorPane?.rect.width).toBeLessThan(500);
  });

  it("applies pane capability defaults and lets explicit true override them", () => {
    const controller = new FocusGridController({
      ...horizontalSplitState(),
      root: {
        kind: "split",
        id: "root",
        orientation: "horizontal",
        sizes: [0.5, 0.5],
        children: [
          {
            kind: "pane",
            id: "left-node",
            paneId: "left",
            canRemove: true,
            canFocus: true,
          },
          {
            kind: "pane",
            id: "right-node",
            paneId: "right",
          },
        ],
      }, paneDefaults: {
        canRemove: false,
        canResizeX: false,
        canFocus: false,
      }
    });

    expect(controller.state.root).toMatchObject({
      kind: "split",
      children: [
        {
          paneId: "left",
          canRemove: true,
          canResizeX: false,
          canFocus: true,
        },
        {
          paneId: "right",
          canRemove: false,
          canResizeX: false,
          canFocus: false,
        },
      ],
    });

    expect(
      controller.split(findPaneNode(controller.state.root, "left")!.id, {
        side: "right",
        newPaneId: "explicit",
        canRemove: true,
        canFocus: true,
      }),
    ).toBe("explicit");
    expect(controller.state.root).toMatchObject({
      kind: "split",
      children: [
        {
          kind: "split",
          children: [
            { paneId: "left" },
            {
              paneId: "explicit",
              canRemove: true,
              canResizeX: false,
              canFocus: true,
            },
          ],
        },
        { paneId: "right" },
      ],
    });
  });

  it("returns null and preserves state when controller.split cannot split", () => {
    const missingTarget = new FocusGridController(initialState());
    const beforeMissingTarget = missingTarget.state;

    expect(
      missingTarget.split("missing", {
        side: "right",
        newPaneId: "terminal",
      }),
    ).toBeNull();
    expect(missingTarget.state).toBe(beforeMissingTarget);

    const duplicatePaneId = new FocusGridController(horizontalSplitState());
    const beforeDuplicatePaneId = duplicatePaneId.state;

    expect(
      duplicatePaneId.split(findPaneNode(duplicatePaneId.state.root, "left")!.id, {
        side: "right",
        newPaneId: "right",
      }),
    ).toBeNull();
    expect(duplicatePaneId.state).toBe(beforeDuplicatePaneId);
  });

  it("splits when there is no active pane without inventing focus memory", () => {
    const controller = new FocusGridController({
      ...initialState(),
      activePaneId: null,
    });

    expect(
      controller.split(findPaneNode(controller.state.root, "editor")!.id, {
        side: "right",
        newPaneId: "terminal",
        preserveActivePane: true,
      }),
    ).toBe("terminal");
    expect(controller.state.activePaneId).toBeNull();
    expect(controller.state.root).toMatchObject({
      kind: "split",
      orientation: "horizontal",
      children: [{ paneId: "editor" }, { paneId: "terminal" }],
    });
  });

  it("accepts option-shaped operations for split and resize", () => {
    const splitController = new FocusGridController(initialState());
    splitController.split(findPaneNode(initialState().root, "editor")!.id, {
      side: "left",
      newPaneId: "nav",
      newPaneNodeId: "nav-node",
      splitId: "nav-split",
      preserveActivePane: true,
    });
    const split = splitController.state;

    expect(split.activePaneId).toBe("editor");
    expect(split.root).toMatchObject({
      kind: "split",
      orientation: "horizontal",
      children: [{ paneId: "nav" }, { paneId: "editor" }],
    });

    const resizedController = new FocusGridController(horizontalSplitState());
    resizedController.resize("left", {
      direction: "right",
      deltaPx: 100,
    });
    const resized = resizedController.state;

    expect(resized.root.kind).toBe("split");
    expect(resized.root.sizes[0]).toBeCloseTo(0.6);
  });

  it("closes a pane and collapses a single-child split", () => {
    const controller = new FocusGridController(initialState());

    controller.split(findPaneNode(controller.state.root, "editor")!.id, { side: "right", newPaneId: "terminal" });
    controller.remove("terminal");

    expect(controller.state.root.kind).toBe("pane");
    expect(controller.state.activePaneId).toBe("editor");
  });

  it("exposes scriptable pane removal through controller", () => {
    const removeActive = new FocusGridController(horizontalSplitState());

    expect(removeActive.remove("left")).toBe(true);
    expect(removeActive.state.root).toMatchObject({
      kind: "pane",
      paneId: "right",
    });
    expect(removeActive.state.activePaneId).toBe("right");

    const removeInactive = new FocusGridController(horizontalSplitState());
    expect(removeInactive.remove("right")).toBe(true);
    expect(removeInactive.state.activePaneId).toBe("left");

    const missing = new FocusGridController(horizontalSplitState());
    const beforeMissing = missing.state;
    expect(missing.remove("missing")).toBe(false);
    expect(missing.state).toBe(beforeMissing);

    const last = new FocusGridController(initialState());
    expect(last.remove("editor")).toBe(false);
    expect(last.state.activePaneId).toBe("editor");
  });

  it("removes nested panes without preserving stale directional focus memory", () => {
    const controller = new FocusGridController(verticalMiddleTrifoldState());

    controller.focus("middle-top");
    expect(controller.remove("middle-top")).toBe(true);

    focusDirection(controller, "left", "right");

    expect(controller.state.activePaneId).toBe("middle-bottom");
  });

  it("swaps pane content while preserving layout slots", () => {
    const controller = new FocusGridController({
      root: {
        kind: "split",
        id: "root",
        orientation: "horizontal",
        sizes: [0.25, 0.75],
        children: [
          {
            kind: "pane",
            id: "left-node",
            paneId: "left",
          },
          {
            kind: "pane",
            id: "right-node",
            paneId: "right",
          },
        ],
      },
      activePaneId: "left",
      container: {
        width: 1000,
        height: 600,
      },
    });

    controller.swap("left", "right");

    const root = controller.state.root;
    expect(root.kind).toBe("split");
    expect(root.sizes).toEqual([0.25, 0.75]);

    const firstSlot = root.children[0]!;
    const secondSlot = root.children[1]!;
    expect(firstSlot.kind).toBe("pane");
    expect(secondSlot.kind).toBe("pane");
    expect(firstSlot).toMatchObject({
      id: "left-node",
      paneId: "right",
    });
    expect(secondSlot).toMatchObject({
      id: "right-node",
      paneId: "left",
    });

    const layout = computeLayout(controller.state);
    const leftPane = layout.panes.find((pane) => pane.paneId === "left");
    const rightPane = layout.panes.find((pane) => pane.paneId === "right");
    expect(leftPane?.active).toBe(true);
    expect(leftPane!.rect.x).toBeGreaterThan(rightPane!.rect.x);
  });

  it("exposes scriptable pane swapping through controller", () => {
    const controller = new FocusGridController(horizontalSplitState());

    expect(controller.swap("left", "right")).toBe(true);
    expect(controller.state.activePaneId).toBe("left");
    expect(controller.state.root).toMatchObject({
      kind: "split",
      sizes: [0.5, 0.5],
      children: [
        { id: "left-node", paneId: "right" },
        { id: "right-node", paneId: "left" },
      ],
    });

    expect(controller.swap("left", "left")).toBe(false);
    expect(controller.swap("left", "missing")).toBe(false);
  });

  it("returns false and preserves state when controller.swap cannot swap", () => {
    const samePane = new FocusGridController(horizontalSplitState());
    const beforeSamePane = samePane.state;

    expect(samePane.swap("left", "left")).toBe(false);
    expect(samePane.state).toBe(beforeSamePane);

    const firstMissing = new FocusGridController(horizontalSplitState());
    const beforeFirstMissing = firstMissing.state;

    expect(firstMissing.swap("missing", "right")).toBe(false);
    expect(firstMissing.state).toBe(beforeFirstMissing);

    const bothMissing = new FocusGridController(horizontalSplitState());
    const beforeBothMissing = bothMissing.state;

    expect(bothMissing.swap("missing-a", "missing-b")).toBe(false);
    expect(bothMissing.state).toBe(beforeBothMissing);
  });

  it("updates split focus memory after swapping the active pane", () => {
    const nextController = new FocusGridController(nestedHorizontalState());
    nextController.swap("left", "middle");
    const next = nextController.state;

    expect(next.activePaneId).toBe("middle");
    expect(next.root.kind).toBe("split");
    expect(next.root.lastFocusedChildId).toBe("left-node");
  });

  it("swaps panes with the direct horizontal and vertical directional neighbors", () => {
    const horizontalController = new FocusGridController(horizontalSplitState());
    expect(defaultPaneShortcutActions.find(action => action.id === "swap-right")!.action(horizontalController)).toBe(true);
    const horizontal = horizontalController.state;

    expect(horizontal.activePaneId).toBe("left");
    expect(horizontal.root.kind).toBe("split");
    expect(horizontal.root.children[0]).toMatchObject({
      id: "left-node",
      paneId: "right",
    });
    expect(horizontal.root.children[1]).toMatchObject({
      id: "right-node",
      paneId: "left",
    });

    const verticalController = new FocusGridController(verticalSplitState());
    expect(defaultPaneShortcutActions.find(action => action.id === "swap-up")!.action(verticalController)).toBe(true);
    const vertical = verticalController.state;

    expect(vertical.activePaneId).toBe("bottom");
    expect(vertical.root.kind).toBe("split");
    expect(vertical.root.children[0]).toMatchObject({
      id: "top-node",
      paneId: "bottom",
    });
    expect(vertical.root.children[1]).toMatchObject({
      id: "bottom-node",
      paneId: "top",
    });
  });

  it("directional swap selects the remembered pane in a nested branch", () => {
    const controller = new FocusGridController(verticalMiddleTrifoldState());
    controller.focus("left");
    expect(findPaneInDirection(controller.state, "left", "right")).toBe("middle-bottom");
    expect(defaultPaneShortcutActions.find(action => action.id === "swap-right")!.action(controller)).toBe(true);
    const swapped = controller.state;

    expect(swapped.activePaneId).toBe("left");
    expect(swapped.root.kind).toBe("split");

    const leftBranch = swapped.root.children[0]!;
    expect(leftBranch.kind).toBe("split");
    expect(leftBranch.children[0]).toMatchObject({
      id: "left-node",
      paneId: "middle-bottom",
    });

    const middle = leftBranch.children[1]!;
    expect(middle.kind).toBe("split");
    expect(middle.children[0]).toMatchObject({
      id: "middle-top-node",
      paneId: "middle-top",
    });
    expect(middle.children[1]).toMatchObject({
      id: "middle-bottom-node",
      paneId: "left",
    });
  });

  it("directional swap preserves split structure and sizes", () => {
    const controller = new FocusGridController(nestedDirectionalFocusState());
    controller.focus("left");
    expect(defaultPaneShortcutActions.find(action => action.id === "swap-right")!.action(controller)).toBe(true);
    const next = controller.state;

    expect(next.root.kind).toBe("split");
    expect(next.root).toMatchObject({
      id: "root",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
    });

    const rightSplit = next.root.children[1]!;
    expect(rightSplit.kind).toBe("split");
    expect(rightSplit).toMatchObject({
      id: "right-split",
      orientation: "vertical",
      sizes: [0.25, 0.75],
    });
  });

  it("resizes a handle from a snapshot", () => {
    const controller = new FocusGridController(initialState());

    controller.split(findPaneNode(controller.state.root, "editor")!.id, { side: "right", newPaneId: "terminal" });

    const split = controller.state.root;
    expect(split.kind).toBe("split");

    controller.resizeHandle(split.id, {
      index: 0,
      deltaPx: 100,
      snapshotSizes: [0.5, 0.5],
    });

    const next = controller.state.root;
    expect(next.kind).toBe("split");
    expect(next.sizes[0]).toBeCloseTo(0.6);
    expect(next.sizes[1]).toBeCloseTo(0.4);
  });

  it("resizes a pane horizontally toward an adjacent pane", () => {
    const controller = new FocusGridController(horizontalSplitState());

    controller.resize("left", {
      direction: "right",
      deltaPx: 100,
    });

    const root = controller.state.root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.6);
    expect(root.sizes[1]).toBeCloseTo(0.4);
  });

  it("resizes a pane vertically toward an adjacent pane", () => {
    const controller = new FocusGridController(verticalSplitState());

    controller.resize("bottom", {
      direction: "up",
      deltaPx: 60,
    });

    const root = controller.state.root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.4);
    expect(root.sizes[1]).toBeCloseTo(0.6);
  });

  it("uses the nearest matching ancestor boundary for pane resize", () => {
    const controller = new FocusGridController(nestedHorizontalState());

    controller.resize("middle", {
      direction: "right",
      deltaPx: 100,
    });

    const root = controller.state.root;
    expect(root.kind).toBe("split");
    expect(root.sizes).toEqual([0.5, 0.5]);

    const nested = root.children[1]!;
    expect(nested.kind).toBe("split");
    expect(nested.sizes[0]).toBeCloseTo(0.701207);
    expect(nested.sizes[1]).toBeCloseTo(0.298793);
  });

  it("resizes a middle pane against the left sibling boundary in a binary trifold", () => {
    const growMiddleController = new FocusGridController(leftNestedTrifoldState());
    growMiddleController.resize("middle", {
      direction: "left",
      deltaPx: 100,
    });
    const growMiddle = growMiddleController.state;

    expect(growMiddle.root.kind).toBe("split");
    expect(growMiddle.root.sizes).toEqual([0.5, 0.5]);

    const grownNested = growMiddle.root.children[0]!;
    expect(grownNested.kind).toBe("split");
    expect(grownNested.sizes[0]).toBeCloseTo(0.298793);
    expect(grownNested.sizes[1]).toBeCloseTo(0.701207);

    const shrinkMiddleController = new FocusGridController(leftNestedTrifoldState());
    shrinkMiddleController.resize("middle", {
      direction: "right",
      deltaPx: 100,
    });
    const shrinkMiddle = shrinkMiddleController.state;

    expect(shrinkMiddle.root.kind).toBe("split");
    expect(shrinkMiddle.root.sizes).toEqual([0.5, 0.5]);

    const shrunkNested = shrinkMiddle.root.children[0]!;
    expect(shrunkNested.kind).toBe("split");
    expect(shrunkNested.sizes[0]).toBeCloseTo(0.701207);
    expect(shrunkNested.sizes[1]).toBeCloseTo(0.298793);
  });

  it("resizes a middle pane against the right sibling boundary in a binary trifold", () => {
    const growMiddleController = new FocusGridController(nestedHorizontalState());
    growMiddleController.resize("middle", {
      direction: "right",
      deltaPx: 100,
    });
    const growMiddle = growMiddleController.state;

    expect(growMiddle.root.kind).toBe("split");
    expect(growMiddle.root.sizes).toEqual([0.5, 0.5]);

    const grownNested = growMiddle.root.children[1]!;
    expect(grownNested.kind).toBe("split");
    expect(grownNested.sizes[0]).toBeCloseTo(0.701207);
    expect(grownNested.sizes[1]).toBeCloseTo(0.298793);

    const shrinkMiddleController = new FocusGridController(nestedHorizontalState());
    shrinkMiddleController.resize("middle", {
      direction: "left",
      deltaPx: 100,
    });
    const shrinkMiddle = shrinkMiddleController.state;

    expect(shrinkMiddle.root.kind).toBe("split");
    expect(shrinkMiddle.root.sizes).toEqual([0.5, 0.5]);

    const shrunkNested = shrinkMiddle.root.children[1]!;
    expect(shrunkNested.kind).toBe("split");
    expect(shrunkNested.sizes[0]).toBeCloseTo(0.298793);
    expect(shrunkNested.sizes[1]).toBeCloseTo(0.701207);
  });

  it("resizes edge panes by moving their sibling boundary", () => {
    const leftEdgeShrinkController = new FocusGridController(horizontalSplitState());
    leftEdgeShrinkController.resize("left", {
      direction: "left",
      deltaPx: 100,
    });
    const leftEdgeShrink = leftEdgeShrinkController.state;

    expect(leftEdgeShrink.root.kind).toBe("split");
    expect(leftEdgeShrink.root.sizes[0]).toBeCloseTo(0.4);
    expect(leftEdgeShrink.root.sizes[1]).toBeCloseTo(0.6);

    const leftEdgeGrowController = new FocusGridController(horizontalSplitState());
    leftEdgeGrowController.resize("left", {
      direction: "right",
      deltaPx: 100,
    });
    const leftEdgeGrow = leftEdgeGrowController.state;

    expect(leftEdgeGrow.root.kind).toBe("split");
    expect(leftEdgeGrow.root.sizes[0]).toBeCloseTo(0.6);
    expect(leftEdgeGrow.root.sizes[1]).toBeCloseTo(0.4);

    const rightEdgeShrinkController = new FocusGridController(horizontalSplitState());
    rightEdgeShrinkController.resize("right", {
      direction: "right",
      deltaPx: 100,
    });
    const rightEdgeShrink = rightEdgeShrinkController.state;

    expect(rightEdgeShrink.root.kind).toBe("split");
    expect(rightEdgeShrink.root.sizes[0]).toBeCloseTo(0.6);
    expect(rightEdgeShrink.root.sizes[1]).toBeCloseTo(0.4);

    const rightEdgeGrowController = new FocusGridController(horizontalSplitState());
    rightEdgeGrowController.resize("right", {
      direction: "left",
      deltaPx: 100,
    });
    const rightEdgeGrow = rightEdgeGrowController.state;

    expect(rightEdgeGrow.root.kind).toBe("split");
    expect(rightEdgeGrow.root.sizes[0]).toBeCloseTo(0.4);
    expect(rightEdgeGrow.root.sizes[1]).toBeCloseTo(0.6);

    const topEdgeShrinkController = new FocusGridController(verticalSplitState());
    topEdgeShrinkController.resize("top", {
      direction: "up",
      deltaPx: 60,
    });
    const topEdgeShrink = topEdgeShrinkController.state;

    expect(topEdgeShrink.root.kind).toBe("split");
    expect(topEdgeShrink.root.sizes[0]).toBeCloseTo(0.4);
    expect(topEdgeShrink.root.sizes[1]).toBeCloseTo(0.6);

    const topEdgeGrowController = new FocusGridController(verticalSplitState());
    topEdgeGrowController.resize("top", {
      direction: "down",
      deltaPx: 60,
    });
    const topEdgeGrow = topEdgeGrowController.state;

    expect(topEdgeGrow.root.kind).toBe("split");
    expect(topEdgeGrow.root.sizes[0]).toBeCloseTo(0.6);
    expect(topEdgeGrow.root.sizes[1]).toBeCloseTo(0.4);

    const bottomEdgeShrinkController = new FocusGridController(verticalSplitState());
    bottomEdgeShrinkController.resize("bottom", {
      direction: "down",
      deltaPx: 60,
    });
    const bottomEdgeShrink = bottomEdgeShrinkController.state;

    expect(bottomEdgeShrink.root.kind).toBe("split");
    expect(bottomEdgeShrink.root.sizes[0]).toBeCloseTo(0.6);
    expect(bottomEdgeShrink.root.sizes[1]).toBeCloseTo(0.4);

    const bottomEdgeGrowController = new FocusGridController(verticalSplitState());
    bottomEdgeGrowController.resize("bottom", {
      direction: "up",
      deltaPx: 60,
    });
    const bottomEdgeGrow = bottomEdgeGrowController.state;

    expect(bottomEdgeGrow.root.kind).toBe("split");
    expect(bottomEdgeGrow.root.sizes[0]).toBeCloseTo(0.4);
    expect(bottomEdgeGrow.root.sizes[1]).toBeCloseTo(0.6);
  });

  it("clamps pane resize to adjacent minimum sizes", () => {
    const controller = new FocusGridController({
      ...horizontalSplitState(),
      minWidth: 400,
      root: {
        kind: "split",
        id: "root",
        orientation: "horizontal",
        sizes: [0.5, 0.5],
        children: [
          {
            kind: "pane",
            id: "left-node",
            paneId: "left",
          },
          {
            kind: "pane",
            id: "right-node",
            paneId: "right",
          },
        ],
      },
    });

    controller.resize("left", {
      direction: "right",
      deltaPx: 300,
    });

    const root = controller.state.root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.6);
    expect(root.sizes[1]).toBeCloseTo(0.4);
  });

  it("uses the target split axis size for nested handle resize", () => {
    const controller = new FocusGridController(nestedHandleState());

    controller.resizeHandle("inner", {
      index: 0,
      deltaPx: 24,
      snapshotSizes: [0.5, 0.5],
    });

    const root = controller.state.root;
    expect(root.kind).toBe("split");

    const inner = root.children[0]!;
    expect(inner.kind).toBe("split");
    expect(inner.sizes[0]).toBeCloseTo(0.596774);
    expect(inner.sizes[1]).toBeCloseTo(0.403226);
  });

  it("refits nested split sizes when resizing a parent handle", () => {
    const controller = new FocusGridController({ ...nestedHandleWithPinnedChildState(), minWidth: 180 });
    const before = computeLayout(controller.state).panes;
    const beforeOne = before.find((pane) => pane.paneId === "one")!;
    const beforeTwo = before.find((pane) => pane.paneId === "two")!;
    const beforeThree = before.find((pane) => pane.paneId === "three")!;

    expect(beforeTwo.rect.width).toBeGreaterThanOrEqual(180);

    expect(
      controller.resizeHandle("root", {
        index: 0,
        deltaPx: -100,
        snapshotSizes: [0.75, 0.25],
      }),
    ).toBe(true);

    const root = controller.state.root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.673077);
    expect(root.sizes[1]).toBeCloseTo(0.326923);

    const inner = root.children[0]!;
    expect(inner.kind).toBe("split");

    const after = computeLayout(controller.state).panes;
    const afterOne = after.find((pane) => pane.paneId === "one")!;
    const afterTwo = after.find((pane) => pane.paneId === "two")!;
    const afterThree = after.find((pane) => pane.paneId === "three")!;

    expect(afterThree.rect.width).toBeGreaterThan(beforeThree.rect.width);
    expect(afterTwo.rect.width).toBeGreaterThanOrEqual(180);
    expect(afterTwo.rect.width).toBeGreaterThanOrEqual(beforeTwo.rect.width - 20);
    expect(afterOne.rect.width).toBeLessThan(beforeOne.rect.width);
  });

  it("runs default pane resize commands against the active pane", () => {
    const controller = new FocusGridController(horizontalSplitState());

    expect(
      defaultPaneShortcutActions.find(action => action.id === "resize-right")!.action(controller),
    ).toBe(true);

    const root = controller.state.root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.548);
    expect(root.sizes[1]).toBeCloseTo(0.452);
  });

  it("blocks default split, remove, and resize commands with pane capabilities", () => {
    const splitRight = new FocusGridController({
      ...horizontalSplitState(),
      root: {
        ...horizontalSplitState().root,
        children: [
          { kind: "pane", id: "left-node", paneId: "left", canSplitHorizontal: false },
          { kind: "pane", id: "right-node", paneId: "right" },
        ],
      },
    });
    const beforeSplitRight = splitRight.state;
    expect(defaultPaneShortcutActions.find(action => action.id === "split-right")!.action(splitRight)).toBeNull();
    expect(splitRight.state).toBe(beforeSplitRight);

    const splitDown = new FocusGridController({
      ...horizontalSplitState(),
      root: {
        ...horizontalSplitState().root,
        children: [
          { kind: "pane", id: "left-node", paneId: "left", canSplitVertical: false },
          { kind: "pane", id: "right-node", paneId: "right" },
        ],
      },
    });
    const beforeSplitDown = splitDown.state;
    expect(defaultPaneShortcutActions.find(action => action.id === "split-down")!.action(splitDown)).toBeNull();
    expect(splitDown.state).toBe(beforeSplitDown);

    const remove = new FocusGridController({
      ...horizontalSplitState(),
      root: {
        ...horizontalSplitState().root,
        children: [
          { kind: "pane", id: "left-node", paneId: "left", canRemove: false },
          { kind: "pane", id: "right-node", paneId: "right" },
        ],
      },
    });
    const beforeRemove = remove.state;
    expect(defaultPaneShortcutActions.find(action => action.id === "close")!.action(remove)).toBe(false);
    expect(remove.state).toBe(beforeRemove);

    const resize = new FocusGridController({
      ...horizontalSplitState(),
      root: {
        ...horizontalSplitState().root,
        children: [
          { kind: "pane", id: "left-node", paneId: "left", canResizeX: false },
          { kind: "pane", id: "right-node", paneId: "right" },
        ],
      },
    });
    const beforeResize = resize.state;
    expect(
      defaultPaneShortcutActions.find(action => action.id === "resize-right")!.action(resize),
    ).toBe(false);
    expect(resize.state).toBe(beforeResize);
  });

  it("keeps direct controller calls unaffected by pane capabilities", () => {
    const controller = new FocusGridController({
      ...horizontalSplitState(),
      root: {
        ...horizontalSplitState().root,
        children: [
          {
            kind: "pane",
            id: "left-node",
            paneId: "left",
            canRemove: false,
            canResizeX: false,
            canSplitHorizontal: false,
            canFocus: false,
          },
          { kind: "pane", id: "right-node", paneId: "right" },
        ],
      },
    });

    expect(
      controller.resize("left", { direction: "right", deltaPx: 48 }),
    ).toBe(true);
    expect(controller.focus("right")).toBe(true);
    expect(controller.focus("left")).toBe(true);
    expect(
      controller.split(findPaneNode(controller.state.root, "right")!.id, { side: "right", newPaneId: "extra" }),
    ).toBe("extra");
    expect(controller.remove("left")).toBe(true);
  });

  it("updates pane command capabilities through controller", () => {
    const controller = new FocusGridController(horizontalSplitState());

    expect(
      controller.updatePane("left", {
        canResizeX: false,
        canFocus: false,
      }),
    ).toBe(true);
    expect(controller.state.root).toMatchObject({
      kind: "split",
      children: [
        { paneId: "left", canResizeX: false, canFocus: false },
        { paneId: "right" },
      ],
    });
    expect(
      controller.updatePane("left", {
        canResizeX: true,
      }),
    ).toBe(true);
    expect(controller.state.root).toMatchObject({
      kind: "split",
      children: [
        { paneId: "left", canResizeX: true, canFocus: false },
        { paneId: "right" },
      ],
    });
    expect(
      controller.updatePane("missing", {
        canFocus: false,
      }),
    ).toBe(false);
  });

  it("exposes scriptable pane resize and focus through controller", () => {
    const controller = new FocusGridController(horizontalSplitState());

    expect(
      controller.resize("left", { direction: "right", deltaPx: 100 }),
    ).toBe(true);
    expect(controller.focus("right")).toBe(true);
    expect(controller.state.activePaneId).toBe("right");
    expect(controller.focus("missing")).toBe(false);
    expect(
      controller.resize("missing", { direction: "right", deltaPx: 100 }),
    ).toBe(false);
  });

  it("returns false and preserves state for no-op controller.resize calls", () => {
    const zeroDelta = new FocusGridController(horizontalSplitState());
    const beforeZeroDelta = zeroDelta.state;

    expect(
      zeroDelta.resize("left", { direction: "right", deltaPx: 0 }),
    ).toBe(false);
    expect(zeroDelta.state).toBe(beforeZeroDelta);

    const noBoundary = new FocusGridController(horizontalSplitState());
    const beforeNoBoundary = noBoundary.state;

    expect(
      noBoundary.resize("left", { direction: "up", deltaPx: 100 }),
    ).toBe(false);
    expect(noBoundary.state).toBe(beforeNoBoundary);

    const zeroContainer = new FocusGridController({
      ...horizontalSplitState(),
      container: {
        width: 0,
        height: 600,
      },
    });
    const beforeZeroContainer = zeroContainer.state;

    expect(
      zeroContainer.resize("left", { direction: "right", deltaPx: 100 }),
    ).toBe(false);
    expect(zeroContainer.state).toBe(beforeZeroContainer);
  });

  it("treats negative controller.resize deltas as inverse movement", () => {
    const controller = new FocusGridController(horizontalSplitState());

    expect(
      controller.resize("left", { direction: "right", deltaPx: -100 }),
    ).toBe(true);

    const root = controller.state.root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.4);
    expect(root.sizes[1]).toBeCloseTo(0.6);
  });

  it("keeps directional focus command-only instead of exposing it on controller", () => {
    const controller = new FocusGridController(horizontalSplitState());

    expect("focusDirection" in controller).toBe(false);
    expect(defaultPaneShortcutActions.find(action => action.id === "focus-right")!.action(controller)).toBe(true);
    expect(controller.state.activePaneId).toBe("right");
  });

  it("returns false and preserves state for no-op controller.focus calls", () => {
    const alreadyFocused = new FocusGridController(initialState());
    const beforeAlreadyFocused = alreadyFocused.state;

    expect(alreadyFocused.focus("editor")).toBe(false);
    expect(alreadyFocused.state).toBe(beforeAlreadyFocused);

    const missing = new FocusGridController(initialState());
    const beforeMissing = missing.state;

    expect(missing.focus("missing")).toBe(false);
    expect(missing.state).toBe(beforeMissing);

    const noActivePane = new FocusGridController({
      ...initialState(),
      activePaneId: null,
    });

    expect(noActivePane.focus("editor")).toBe(true);
    expect(noActivePane.state.activePaneId).toBe("editor");
  });

  it("focuses horizontally adjacent panes", () => {
    const controller = new FocusGridController(horizontalSplitState());

    focusDirection(controller, "left", "right");

    expect(controller.state.activePaneId).toBe("right");

    focusDirection(controller, "right", "left");

    expect(controller.state.activePaneId).toBe("left");
  });

  it("focuses vertically adjacent panes", () => {
    const controller = new FocusGridController(verticalSplitState());

    focusDirection(controller, "bottom", "up");

    expect(controller.state.activePaneId).toBe("top");

    focusDirection(controller, "top", "down");

    expect(controller.state.activePaneId).toBe("bottom");
  });

  it("chooses the closest edge pane in a nested directional sibling", () => {
    const controller = new FocusGridController(nestedDirectionalFocusState());

    focusDirection(controller, "left", "right");

    expect(controller.state.activePaneId).toBe("lower-right");
  });

  it("remembers the last focused pane inside an ambiguous directional split", () => {
    const controller = new FocusGridController(verticalMiddleTrifoldState());

    controller.focus("middle-top");
    focusDirection(controller, "middle-top", "left");
    focusDirection(controller, "left", "right");

    expect(controller.state.activePaneId).toBe("middle-top");

    controller.focus("middle-bottom");
    focusDirection(controller, "middle-bottom", "right");
    focusDirection(controller, "right", "left");

    expect(controller.state.activePaneId).toBe("middle-bottom");
  });

  it("keeps the closest entering edge ahead of remembered split focus", () => {
    const controller = new FocusGridController(horizontalTargetWithStaleMemoryState());

    focusDirection(controller, "left", "right");

    expect(controller.state.activePaneId).toBe("near");
  });

  it("ignores stale split focus memory after a remembered pane is closed", () => {
    const controller = new FocusGridController(verticalMiddleTrifoldState());

    controller.focus("middle-top");
    controller.remove("middle-top");
    focusDirection(controller, "left", "right");

    expect(controller.state.activePaneId).toBe("middle-bottom");
  });

  it("marks a newly split pane as focused in split memory", () => {
    const controller = new FocusGridController(verticalMiddleTrifoldState());

    controller.split(findPaneNode(controller.state.root, "middle-top")!.id, {
      side: "down",
      newPaneId: "middle-top-bottom",
    });
    focusDirection(controller, "middle-top-bottom", "left");
    focusDirection(controller, "left", "right");

    expect(controller.state.activePaneId).toBe("middle-top-bottom");
  });

  it("uses nested split memory when geometry would pick another pane in the branch", () => {
    const controller = new FocusGridController(verticalMiddleTrifoldState());

    controller.split(findPaneNode(controller.state.root, "middle-top")!.id, {
      side: "down",
      newPaneId: "middle-top-bottom",
    });
    controller.focus("middle-top");
    focusDirection(controller, "middle-top", "left");
    focusDirection(controller, "left", "right");

    expect(controller.state.activePaneId).toBe("middle-top");
  });

  it("returns the same state when no directional sibling matches", () => {
    const state = horizontalSplitState();
    expect(findPaneInDirection(state, "left", "left")).toBeNull();
  });

  it("runs default pane directional focus commands against the active pane", () => {
    const controller = new FocusGridController(horizontalSplitState());

    expect(defaultPaneShortcutActions.find(action => action.id === "focus-right")!.action(controller)).toBe(true);

    expect(controller.state.activePaneId).toBe("right");
  });

  it("skips canFocus false panes for default focus commands", () => {
    const controller = new FocusGridController(threePaneHorizontalState("left", {
      middle: { canFocus: false },
    }));
    expect(defaultPaneShortcutActions.find(action => action.id === "focus-right")!.action(controller)).toBe(true);
    expect(controller.state.activePaneId).toBe("right");

    const allBlocked = new FocusGridController(threePaneHorizontalState("left", {
      middle: { canFocus: false },
      right: { canFocus: false },
    }));
    expect(defaultPaneShortcutActions.find(action => action.id === "focus-right")!.action(allBlocked)).toBe(false);
    expect(allBlocked.state.activePaneId).toBe("left");
  });

  it("keeps resize and swap capabilities scoped to their axis", () => {
    const resize = new FocusGridController({
      ...verticalSplitState(),
      activePaneId: "top",
      root: {
        ...verticalSplitState().root,
        children: [
          { kind: "pane", id: "top-node", paneId: "top", canResizeX: false },
          { kind: "pane", id: "bottom-node", paneId: "bottom" },
        ],
      },
    });
    expect(
      defaultPaneShortcutActions.find(action => action.id === "resize-down")!.action(resize),
    ).toBe(true);
    const resizeRoot = resize.state.root;
    expect(resizeRoot.kind).toBe("split");
    expect(resizeRoot.sizes[0]).toBeGreaterThan(0.5);

    const swap = new FocusGridController({
      ...verticalSplitState(),
      activePaneId: "top",
      root: {
        ...verticalSplitState().root,
        children: [
          { kind: "pane", id: "top-node", paneId: "top", canSwapX: false },
          { kind: "pane", id: "bottom-node", paneId: "bottom" },
        ],
      },
    });
    expect(defaultPaneShortcutActions.find(action => action.id === "swap-down")!.action(swap)).toBe(true);
    expect(swap.state.root).toMatchObject({
      kind: "split",
      children: [{ paneId: "bottom" }, { paneId: "top" }],
    });
  });

  it("wraps directional focus only when overflow is enabled", () => {
    const blocked = new FocusGridController(threePaneHorizontalState("right"));
    expect(defaultPaneShortcutActions.find(action => action.id === "focus-right")!.action(blocked)).toBe(false);
    expect(blocked.state.activePaneId).toBe("right");

    const wrapping = new FocusGridController({ ...threePaneHorizontalState("right"), directionalFocusOverflow: true });
    expect(defaultPaneShortcutActions.find(action => action.id === "focus-right")!.action(wrapping)).toBe(true);
    expect(wrapping.state.activePaneId).toBe("left");
  });

  it("applies focus capabilities during overflow search and never refocuses active pane", () => {
    const controller = new FocusGridController({
      ...threePaneHorizontalState("right", {
        left: { canFocus: false },
      }), directionalFocusOverflow: true
    });

    expect(defaultPaneShortcutActions.find(action => action.id === "focus-right")!.action(controller)).toBe(true);
    expect(controller.state.activePaneId).toBe("middle");

    const allBlocked = new FocusGridController({
      ...threePaneHorizontalState("right", {
        left: { canFocus: false },
        middle: { canFocus: false },
      }), directionalFocusOverflow: true
    });

    expect(defaultPaneShortcutActions.find(action => action.id === "focus-right")!.action(allBlocked)).toBe(false);
    expect(allBlocked.state.activePaneId).toBe("right");
  });

  it("runs default pane directional swap commands against the active pane", () => {
    const controller = new FocusGridController(horizontalSplitState());

    expect(defaultPaneShortcutActions.find(action => action.id === "swap-right")!.action(controller)).toBe(true);

    const state = controller.state;
    expect(state.activePaneId).toBe("left");
    expect(state.root.kind).toBe("split");
    expect(state.root.children[0]).toMatchObject({ paneId: "right" });
    expect(state.root.children[1]).toMatchObject({ paneId: "left" });
  });

  it("blocks default directional swap when active or target pane disallows the axis", () => {
    const activeBlocked = new FocusGridController(threePaneHorizontalState("left", {
      left: { canSwapX: false },
    }));
    expect(defaultPaneShortcutActions.find(action => action.id === "swap-right")!.action(activeBlocked)).toBe(false);
    expect(activeBlocked.state.root).toMatchObject({
      kind: "split",
      children: [
        { paneId: "left" },
        {
          kind: "split",
          children: [{ paneId: "middle" }, { paneId: "right" }],
        },
      ],
    });

    const targetBlocked = new FocusGridController(threePaneHorizontalState("left", {
      middle: { canSwapX: false },
    }));
    expect(defaultPaneShortcutActions.find(action => action.id === "swap-right")!.action(targetBlocked)).toBe(false);
    expect(targetBlocked.state.root).toMatchObject({
      kind: "split",
      children: [
        { paneId: "left" },
        {
          kind: "split",
          children: [{ paneId: "middle" }, { paneId: "right" }],
        },
      ],
    });
  });
});

function horizontalSplitState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        {
          kind: "pane",
          id: "left-node",
          paneId: "left",
        },
        {
          kind: "pane",
          id: "right-node",
          paneId: "right",
        },
      ],
    },
    activePaneId: "left",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

function verticalSplitState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "vertical",
      sizes: [0.5, 0.5],
      children: [
        {
          kind: "pane",
          id: "top-node",
          paneId: "top",
        },
        {
          kind: "pane",
          id: "bottom-node",
          paneId: "bottom",
        },
      ],
    },
    activePaneId: "bottom",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

function threePaneHorizontalState(
  activePaneId: "left" | "middle" | "right" = "left",
  capabilities: Partial<
    Record<"left" | "middle" | "right", PaneCommandCapabilityInput>
  > = {},
): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [1 / 3, 2 / 3],
      children: [
        {
          kind: "pane",
          id: "left-node",
          paneId: "left",
          ...capabilities.left,
        },
        {
          kind: "split",
          id: "right-branch",
          orientation: "horizontal",
          sizes: [0.5, 0.5],
          children: [
            {
              kind: "pane",
              id: "middle-node",
              paneId: "middle",
              ...capabilities.middle,
            },
            {
              kind: "pane",
              id: "right-node",
              paneId: "right",
              ...capabilities.right,
            },
          ],
        },
      ],
    },
    activePaneId,
    container: {
      width: 900,
      height: 600,
    },
  };
}

function leftNestedTrifoldState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        {
          kind: "split",
          id: "nested",
          orientation: "horizontal",
          sizes: [0.5, 0.5],
          children: [
            {
              kind: "pane",
              id: "left-node",
              paneId: "left",
            },
            {
              kind: "pane",
              id: "middle-node",
              paneId: "middle",
            },
          ],
        },
        {
          kind: "pane",
          id: "right-node",
          paneId: "right",
        },
      ],
    },
    activePaneId: "middle",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

function nestedHorizontalState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        {
          kind: "pane",
          id: "left-node",
          paneId: "left",
        },
        {
          kind: "split",
          id: "nested",
          orientation: "horizontal",
          sizes: [0.5, 0.5],
          children: [
            {
              kind: "pane",
              id: "middle-node",
              paneId: "middle",
            },
            {
              kind: "pane",
              id: "right-node",
              paneId: "right",
            },
          ],
        },
      ],
    },
    activePaneId: "middle",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

function nestedHandleState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.25, 0.75],
      children: [
        {
          kind: "split",
          id: "inner",
          orientation: "horizontal",
          sizes: [0.5, 0.5],
          children: [
            {
              kind: "pane",
              id: "inner-left-node",
              paneId: "inner-left",
            },
            {
              kind: "pane",
              id: "inner-right-node",
              paneId: "inner-right",
            },
          ],
        },
        {
          kind: "pane",
          id: "outside-node",
          paneId: "outside",
        },
      ],
    },
    activePaneId: "inner-left",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

function nestedHandleWithPinnedChildState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.75, 0.25],
      children: [
        {
          kind: "split",
          id: "inner",
          orientation: "horizontal",
          sizes: [0.8, 0.2],
          children: [
            {
              kind: "pane",
              id: "one-node",
              paneId: "one",
            },
            {
              kind: "pane",
              id: "two-node",
              paneId: "two",
            },
          ],
        },
        {
          kind: "pane",
          id: "three-node",
          paneId: "three",
        },
      ],
    },
    activePaneId: "three",
    container: {
      width: 1300,
      height: 600,
    },
  };
}

function nestedDirectionalFocusState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        {
          kind: "pane",
          id: "left-node",
          paneId: "left",
        },
        {
          kind: "split",
          id: "right-split",
          orientation: "vertical",
          sizes: [0.25, 0.75],
          children: [
            {
              kind: "pane",
              id: "upper-right-node",
              paneId: "upper-right",
            },
            {
              kind: "pane",
              id: "lower-right-node",
              paneId: "lower-right",
            },
          ],
        },
      ],
    },
    activePaneId: "left",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

function verticalMiddleTrifoldState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.75, 0.25],
      children: [
        {
          kind: "split",
          id: "left-branch",
          orientation: "horizontal",
          sizes: [1 / 3, 2 / 3],
          children: [
            {
              kind: "pane",
              id: "left-node",
              paneId: "left",
            },
            {
              kind: "split",
              id: "middle-split",
              orientation: "vertical",
              sizes: [0.25, 0.75],
              children: [
                {
                  kind: "pane",
                  id: "middle-top-node",
                  paneId: "middle-top",
                },
                {
                  kind: "pane",
                  id: "middle-bottom-node",
                  paneId: "middle-bottom",
                },
              ],
            },
          ],
        },
        {
          kind: "pane",
          id: "right-node",
          paneId: "right",
        },
      ],
    },
    activePaneId: "middle-bottom",
    container: {
      width: 1200,
      height: 600,
    },
  };
}

function horizontalTargetWithStaleMemoryState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.3, 0.7],
      children: [
        {
          kind: "pane",
          id: "left-node",
          paneId: "left",
        },
        {
          kind: "split",
          id: "right-split",
          orientation: "horizontal",
          sizes: [0.5, 0.5],
          lastFocusedChildId: "far-node",
          children: [
            {
              kind: "pane",
              id: "near-node",
              paneId: "near",
            },
            {
              kind: "pane",
              id: "far-node",
              paneId: "far",
            },
          ],
        },
      ],
    },
    activePaneId: "left",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

describe("keyboard", () => {
  it("creates typed default pane shortcut values from the exported actions", () => {
    expect(createDefaultPaneShortcuts()).toEqual(
      Object.fromEntries(
        defaultPaneShortcutActions.map((action) => [
          action.id,
          action.defaultSequence,
        ]),
      ),
    );
  });

  it("creates callback bindings that act on the current active pane", () => {
    const controller = new FocusGridController(horizontalSplitState());
    const keymap = createDefaultPaneKeymap(controller);
    expect(keymap).toHaveLength(defaultPaneShortcutActions.length);
    const resize = keymap.find(binding => JSON.stringify(binding.sequence) === JSON.stringify("Ctrl-B L"))!;
    expect(resize.repeat).toBe(true);
    resize.action({} as KeyboardEvent);
    expect(computeLayout(controller.state).panes[0]!.rect.width).toBeGreaterThan(500);
    const split = keymap.find(binding => JSON.stringify(binding.sequence) === JSON.stringify("Ctrl-B %"))!;
    controller.focus("right");
    split.action({} as KeyboardEvent);
    expect(computeLayout(controller.state).panes).toHaveLength(3);
  });
});
