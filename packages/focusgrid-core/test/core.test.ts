import { describe, expect, it } from "vitest";
import { parseKeySequence } from "@focusgrid/shortcut-engine";
import {
  cardinalDirections,
  createDefaultPaneKeymap,
  createDefaultPaneShortcuts,
  createFocusGridController,
  defaultPaneShortcutActions,
  focusPane,
  focusPaneInDirection,
  paneFocusDirections,
  paneResizeDirections,
  paneSplitSides,
  paneSwapDirections,
  resizeHandle,
  resizePane,
  splitPane,
  swapPaneInDirection,
  swapPanes,
  wrapRootInSplit,
  type PaneFocusDirection,
  type FocusGridControllerState,
} from "../src";

function initialState(): FocusGridControllerState {
  return {
    root: {
      kind: "pane",
      id: "node-1",
      paneId: "editor",
      minWidth: 120,
      minHeight: 80,
    },
    activePaneId: "editor",
    container: {
      width: 1000,
      height: 600,
    },
  };
}

function focusDirection(
  controller: ReturnType<typeof createFocusGridController>,
  paneId: string,
  direction: PaneFocusDirection,
): boolean {
  const next = focusPaneInDirection(controller.getState(), paneId, direction);
  const target = next.activePaneId;

  return target !== null && controller.api.focus(target);
}

describe("controller", () => {
  it("splits panes and computes rectangles", () => {
    const controller = createFocusGridController(initialState());

    controller.api.split("editor", { side: "right", newPaneId: "terminal" });

    const state = controller.getState();
    const layout = controller.getComputedLayout();

    expect(state.root.kind).toBe("split");
    expect(state.activePaneId).toBe("terminal");
    expect(layout.panes).toHaveLength(2);
    expect(layout.handles).toHaveLength(1);
    expect(layout.panes[0]!.rect.width + layout.panes[1]!.rect.width + 6).toBe(
      1000,
    );
  });

  it("exposes scriptable split placement through controller.api", () => {
    const right = createFocusGridController(initialState());
    expect(
      right.api.split("editor", {
        side: "right",
        newPaneId: "terminal",
      }),
    ).toBe("terminal");
    expect(right.getState().activePaneId).toBe("terminal");
    expect(right.getState().root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      children: [{ paneId: "editor" }, { paneId: "terminal" }],
    });

    const left = createFocusGridController(initialState());
    expect(left.api.split("editor", { side: "left", newPaneId: "nav" })).toBe(
      "nav",
    );
    expect(left.getState().root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      children: [{ paneId: "nav" }, { paneId: "editor" }],
    });

    const down = createFocusGridController(initialState());
    expect(
      down.api.split("editor", { side: "down", newPaneId: "console" }),
    ).toBe("console");
    expect(down.getState().root).toMatchObject({
      kind: "split",
      direction: "vertical",
      children: [{ paneId: "editor" }, { paneId: "console" }],
    });

    const up = createFocusGridController(initialState());
    expect(up.api.split("editor", { side: "up", newPaneId: "search" })).toBe(
      "search",
    );
    expect(up.getState().root).toMatchObject({
      kind: "split",
      direction: "vertical",
      children: [{ paneId: "search" }, { paneId: "editor" }],
    });
  });

  it("returns generated split pane ids and can preserve the active pane", () => {
    const generated = createFocusGridController(initialState());
    const newPaneId = generated.api.split("editor", { side: "right" });

    expect(newPaneId).toEqual(expect.stringMatching(/^pane-/));
    expect(generated.getState().activePaneId).toBe(newPaneId);
    expect(
      generated.getComputedLayout().panes.map((pane) => pane.paneId),
    ).toContain(newPaneId);

    const preserved = createFocusGridController(initialState());
    expect(
      preserved.api.split("editor", {
        side: "right",
        newPaneId: "terminal",
        preserveActivePane: true,
      }),
    ).toBe("terminal");
    expect(preserved.getState().activePaneId).toBe("editor");
  });

  it("applies configured default minimum pane dimensions", () => {
    const controller = createFocusGridController(
      {
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
      },
      {
        paneDefaults: {
          minWidth: 300,
          minHeight: 200,
        },
      },
    );

    expect(controller.getState().root).toMatchObject({
      kind: "pane",
      paneId: "editor",
      minWidth: 300,
      minHeight: 200,
    });

    expect(
      controller.api.split("editor", {
        side: "right",
        newPaneId: "terminal",
      }),
    ).toBe("terminal");
    expect(controller.getState().root).toMatchObject({
      kind: "split",
      children: [
        { paneId: "editor", minWidth: 300, minHeight: 200 },
        { paneId: "terminal", minWidth: 300, minHeight: 200 },
      ],
    });

    expect(
      controller.api.resize("editor", { direction: "right", deltaPx: -400 }),
    ).toBe(true);

    const root = controller.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.3);
    expect(
      controller.api.resize("editor", { direction: "right", deltaPx: -1 }),
    ).toBe(false);

    const editorPane = controller
      .getComputedLayout()
      .panes.find((pane) => pane.paneId === "editor");
    expect(editorPane?.rect.width).toBeLessThan(500);
  });

  it("wraps the whole root in a split through controller.api", () => {
    const right = createFocusGridController(initialState());
    expect(
      right.api.wrapRootInSplit({
        side: "right",
        newPaneId: "sidebar",
        minWidth: 180,
        minHeight: 120,
        data: { role: "sidebar" },
      }),
    ).toBe("sidebar");
    expect(right.getState().activePaneId).toBe("sidebar");
    expect(right.getState().root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      sizes: [0.5, 0.5],
      lastFocusedChildId: expect.stringMatching(/^node-/),
      children: [
        { kind: "pane", id: "node-1", paneId: "editor" },
        {
          kind: "pane",
          paneId: "sidebar",
          minWidth: 180,
          minHeight: 120,
          data: { role: "sidebar" },
        },
      ],
    });

    const left = createFocusGridController(initialState());
    expect(left.api.wrapRootInSplit({ side: "left", newPaneId: "nav" })).toBe(
      "nav",
    );
    expect(left.getState().root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      children: [{ paneId: "nav" }, { paneId: "editor" }],
    });

    const down = createFocusGridController(initialState());
    expect(
      down.api.wrapRootInSplit({ side: "down", newPaneId: "console" }),
    ).toBe("console");
    expect(down.getState().root).toMatchObject({
      kind: "split",
      direction: "vertical",
      children: [{ paneId: "editor" }, { paneId: "console" }],
    });

    const up = createFocusGridController(initialState());
    expect(up.api.wrapRootInSplit({ side: "up", newPaneId: "search" })).toBe(
      "search",
    );
    expect(up.getState().root).toMatchObject({
      kind: "split",
      direction: "vertical",
      children: [{ paneId: "search" }, { paneId: "editor" }],
    });
  });

  it("uses pane defaults for wrapped panes unless wrap options override them", () => {
    const defaulted = createFocusGridController(initialState(), {
      paneDefaults: {
        minWidth: 240,
        minHeight: 160,
      },
    });

    expect(
      defaulted.api.wrapRootInSplit({
        side: "right",
        newPaneId: "sidebar",
      }),
    ).toBe("sidebar");
    expect(defaulted.getState().root).toMatchObject({
      kind: "split",
      children: [
        { paneId: "editor", minWidth: 120, minHeight: 80 },
        { paneId: "sidebar", minWidth: 240, minHeight: 160 },
      ],
    });

    const overridden = createFocusGridController(initialState(), {
      paneDefaults: {
        minWidth: 240,
        minHeight: 160,
      },
    });

    expect(
      overridden.api.wrapRootInSplit({
        side: "right",
        newPaneId: "sidebar",
        minWidth: 180,
      }),
    ).toBe("sidebar");
    expect(overridden.getState().root).toMatchObject({
      kind: "split",
      children: [
        { paneId: "editor", minWidth: 120, minHeight: 80 },
        { paneId: "sidebar", minWidth: 180, minHeight: 160 },
      ],
    });
  });

  it("wraps an existing split root as one child and can preserve active focus", () => {
    const controller = createFocusGridController(horizontalSplitState());
    const oldRoot = controller.getState().root;

    expect(
      controller.api.wrapRootInSplit({
        side: "left",
        newPaneId: "activity",
        preserveActivePane: true,
      }),
    ).toBe("activity");

    const state = controller.getState();
    expect(state.activePaneId).toBe("left");
    expect(state.root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      children: [{ paneId: "activity" }, oldRoot],
      lastFocusedChildId: "root",
    });
  });

  it("returns generated root wrapper pane ids and preserves state on duplicates", () => {
    const generated = createFocusGridController(initialState());
    const newPaneId = generated.api.wrapRootInSplit({ side: "right" });

    expect(newPaneId).toEqual(expect.stringMatching(/^pane-/));
    expect(generated.getState().activePaneId).toBe(newPaneId);
    expect(
      generated.getComputedLayout().panes.map((pane) => pane.paneId),
    ).toContain(newPaneId);

    const duplicatePaneId = createFocusGridController(horizontalSplitState());
    const beforeDuplicatePaneId = duplicatePaneId.getState();

    expect(
      duplicatePaneId.api.wrapRootInSplit({
        side: "right",
        newPaneId: "right",
      }),
    ).toBeNull();
    expect(duplicatePaneId.getState()).toBe(beforeDuplicatePaneId);
  });

  it("returns null and preserves state when controller.api.split cannot split", () => {
    const missingTarget = createFocusGridController(initialState());
    const beforeMissingTarget = missingTarget.getState();

    expect(
      missingTarget.api.split("missing", {
        side: "right",
        newPaneId: "terminal",
      }),
    ).toBeNull();
    expect(missingTarget.getState()).toBe(beforeMissingTarget);

    const duplicatePaneId = createFocusGridController(horizontalSplitState());
    const beforeDuplicatePaneId = duplicatePaneId.getState();

    expect(
      duplicatePaneId.api.split("left", {
        side: "right",
        newPaneId: "right",
      }),
    ).toBeNull();
    expect(duplicatePaneId.getState()).toBe(beforeDuplicatePaneId);
  });

  it("splits when there is no active pane without inventing focus memory", () => {
    const controller = createFocusGridController({
      ...initialState(),
      activePaneId: null,
    });

    expect(
      controller.api.split("editor", {
        side: "right",
        newPaneId: "terminal",
        preserveActivePane: true,
      }),
    ).toBe("terminal");
    expect(controller.getState().activePaneId).toBeNull();
    expect(controller.getState().root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      children: [{ paneId: "editor" }, { paneId: "terminal" }],
    });
  });

  it("accepts option-shaped operations for split, root wrap, and resize", () => {
    const split = splitPane(initialState(), "editor", {
      side: "left",
      newPaneId: "nav",
      preserveActivePane: true,
    });

    expect(split.activePaneId).toBe("editor");
    expect(split.root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      children: [{ paneId: "nav" }, { paneId: "editor" }],
    });

    const wrapped = wrapRootInSplit(initialState(), {
      side: "down",
      newPaneId: "console",
    });

    expect(wrapped.activePaneId).toBe("console");
    expect(wrapped.root).toMatchObject({
      kind: "split",
      direction: "vertical",
      children: [{ paneId: "editor" }, { paneId: "console" }],
    });

    const resized = resizePane(horizontalSplitState(), "left", {
      direction: "right",
      deltaPx: 100,
    });

    expect(resized.root.kind).toBe("split");
    expect(resized.root.sizes[0]).toBeCloseTo(0.6);
  });

  it("closes a pane and collapses a single-child split", () => {
    const controller = createFocusGridController(initialState());

    controller.api.split("editor", { side: "right", newPaneId: "terminal" });
    controller.api.remove("terminal");

    expect(controller.getState().root.kind).toBe("pane");
    expect(controller.getState().activePaneId).toBe("editor");
  });

  it("exposes scriptable pane removal through controller.api", () => {
    const removeActive = createFocusGridController(horizontalSplitState());

    expect(removeActive.api.remove("left")).toBe(true);
    expect(removeActive.getState().root).toMatchObject({
      kind: "pane",
      paneId: "right",
    });
    expect(removeActive.getState().activePaneId).toBe("right");

    const removeInactive = createFocusGridController(horizontalSplitState());
    expect(removeInactive.api.remove("right")).toBe(true);
    expect(removeInactive.getState().activePaneId).toBe("left");

    const missing = createFocusGridController(horizontalSplitState());
    const beforeMissing = missing.getState();
    expect(missing.api.remove("missing")).toBe(false);
    expect(missing.getState()).toBe(beforeMissing);

    const last = createFocusGridController(initialState());
    expect(last.api.remove("editor")).toBe(false);
    expect(last.getState().activePaneId).toBe("editor");
  });

  it("removes nested panes without preserving stale directional focus memory", () => {
    const controller = createFocusGridController(verticalMiddleTrifoldState());

    controller.api.focus("middle-top");
    expect(controller.api.remove("middle-top")).toBe(true);

    focusDirection(controller, "left", "right");

    expect(controller.getState().activePaneId).toBe("middle-bottom");
  });

  it("swaps pane content while preserving layout slots", () => {
    const controller = createFocusGridController({
      root: {
        kind: "split",
        id: "root",
        direction: "horizontal",
        sizes: [0.25, 0.75],
        children: [
          {
            kind: "pane",
            id: "left-node",
            paneId: "left",
            minWidth: 100,
            data: { title: "Left" },
          },
          {
            kind: "pane",
            id: "right-node",
            paneId: "right",
            minHeight: 200,
            data: { title: "Right" },
          },
        ],
      },
      activePaneId: "left",
      container: {
        width: 1000,
        height: 600,
      },
    });

    controller.api.swap("left", "right");

    const root = controller.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes).toEqual([0.25, 0.75]);

    const firstSlot = root.children[0]!;
    const secondSlot = root.children[1]!;
    expect(firstSlot.kind).toBe("pane");
    expect(secondSlot.kind).toBe("pane");
    expect(firstSlot).toMatchObject({
      id: "left-node",
      paneId: "right",
      minHeight: 200,
      data: { title: "Right" },
    });
    expect(secondSlot).toMatchObject({
      id: "right-node",
      paneId: "left",
      minWidth: 100,
      data: { title: "Left" },
    });

    const layout = controller.getComputedLayout();
    const leftPane = layout.panes.find((pane) => pane.paneId === "left");
    const rightPane = layout.panes.find((pane) => pane.paneId === "right");
    expect(leftPane?.active).toBe(true);
    expect(leftPane!.rect.x).toBeGreaterThan(rightPane!.rect.x);
  });

  it("exposes scriptable pane swapping through controller.api", () => {
    const controller = createFocusGridController(horizontalSplitState());

    expect(controller.api.swap("left", "right")).toBe(true);
    expect(controller.getState().activePaneId).toBe("left");
    expect(controller.getState().root).toMatchObject({
      kind: "split",
      sizes: [0.5, 0.5],
      children: [
        { id: "left-node", paneId: "right" },
        { id: "right-node", paneId: "left" },
      ],
    });

    expect(controller.api.swap("left", "left")).toBe(false);
    expect(controller.api.swap("left", "missing")).toBe(false);
  });

  it("returns false and preserves state when controller.api.swap cannot swap", () => {
    const samePane = createFocusGridController(horizontalSplitState());
    const beforeSamePane = samePane.getState();

    expect(samePane.api.swap("left", "left")).toBe(false);
    expect(samePane.getState()).toBe(beforeSamePane);

    const firstMissing = createFocusGridController(horizontalSplitState());
    const beforeFirstMissing = firstMissing.getState();

    expect(firstMissing.api.swap("missing", "right")).toBe(false);
    expect(firstMissing.getState()).toBe(beforeFirstMissing);

    const bothMissing = createFocusGridController(horizontalSplitState());
    const beforeBothMissing = bothMissing.getState();

    expect(bothMissing.api.swap("missing-a", "missing-b")).toBe(false);
    expect(bothMissing.getState()).toBe(beforeBothMissing);
  });

  it("updates split focus memory after swapping the active pane", () => {
    const next = swapPanes(nestedHorizontalState(), "left", "middle");

    expect(next.activePaneId).toBe("middle");
    expect(next.root.kind).toBe("split");
    expect(next.root.lastFocusedChildId).toBe("left-node");
  });

  it("swaps panes with the direct horizontal and vertical directional neighbors", () => {
    const horizontal = swapPaneInDirection(horizontalSplitState(), "left", "right");

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

    const vertical = swapPaneInDirection(verticalSplitState(), "bottom", "up");

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

  it("directional swap uses the same nested target as directional focus", () => {
    const state = verticalMiddleTrifoldState();
    const focused = focusPaneInDirection(state, "left", "right");
    const swapped = swapPaneInDirection(state, "left", "right");

    expect(focused.activePaneId).toBe("middle-bottom");
    expect(swapped.activePaneId).toBe("middle-bottom");
    expect(swapped.root.kind).toBe("split");

    const middle = swapped.root.children[1]!;
    expect(middle.kind).toBe("split");
    expect(middle.children[0]).toMatchObject({
      id: "middle-top-node",
      paneId: "middle-top",
    });
    expect(middle.children[1]).toMatchObject({
      id: "middle-bottom-node",
      paneId: "left",
    });
    expect(swapped.root.children[0]).toMatchObject({
      id: "left-node",
      paneId: "middle-bottom",
    });
  });

  it("directional swap preserves split structure and sizes", () => {
    const next = swapPaneInDirection(
      nestedDirectionalFocusState(),
      "left",
      "right",
    );

    expect(next.root.kind).toBe("split");
    expect(next.root).toMatchObject({
      id: "root",
      direction: "horizontal",
      sizes: [0.5, 0.5],
    });

    const rightSplit = next.root.children[1]!;
    expect(rightSplit.kind).toBe("split");
    expect(rightSplit).toMatchObject({
      id: "right-split",
      direction: "vertical",
      sizes: [0.25, 0.75],
    });
  });

  it("returns the same state when panes cannot be swapped", () => {
    const state = horizontalSplitState();

    expect(swapPanes(state, "left", "left")).toBe(state);
    expect(swapPanes(state, "left", "missing")).toBe(state);
    expect(swapPaneInDirection(state, "left", "up")).toBe(state);
    expect(swapPanes(state, "missing", "right")).toBe(state);
  });

  it("resizes a handle from a snapshot", () => {
    const controller = createFocusGridController(initialState());

    controller.api.split("editor", { side: "right", newPaneId: "terminal" });

    const split = controller.getState().root;
    expect(split.kind).toBe("split");

    controller.api.resizeHandle(split.id, {
      index: 0,
      deltaPx: 100,
      snapshotSizes: [0.5, 0.5],
    });

    const next = controller.getState().root;
    expect(next.kind).toBe("split");
    expect(next.sizes[0]).toBeCloseTo(0.6);
    expect(next.sizes[1]).toBeCloseTo(0.4);
  });

  it("resizes a pane horizontally toward an adjacent pane", () => {
    const controller = createFocusGridController(horizontalSplitState());

    controller.api.resize("left", {
      direction: "right",
      deltaPx: 100,
    });

    const root = controller.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.6);
    expect(root.sizes[1]).toBeCloseTo(0.4);
  });

  it("resizes a pane vertically toward an adjacent pane", () => {
    const controller = createFocusGridController(verticalSplitState());

    controller.api.resize("bottom", {
      direction: "up",
      deltaPx: 60,
    });

    const root = controller.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.4);
    expect(root.sizes[1]).toBeCloseTo(0.6);
  });

  it("uses the nearest matching ancestor boundary for pane resize", () => {
    const controller = createFocusGridController(nestedHorizontalState());

    controller.api.resize("middle", {
      direction: "right",
      deltaPx: 100,
    });

    const root = controller.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes).toEqual([0.5, 0.5]);

    const nested = root.children[1]!;
    expect(nested.kind).toBe("split");
    expect(nested.sizes[0]).toBeCloseTo(0.701207);
    expect(nested.sizes[1]).toBeCloseTo(0.298793);
  });

  it("resizes a middle pane against the left sibling boundary in a binary trifold", () => {
    const growMiddle = resizePane(leftNestedTrifoldState(), "middle", {
      direction: "left",
      deltaPx: 100,
    });

    expect(growMiddle.root.kind).toBe("split");
    expect(growMiddle.root.sizes).toEqual([0.5, 0.5]);

    const grownNested = growMiddle.root.children[0]!;
    expect(grownNested.kind).toBe("split");
    expect(grownNested.sizes[0]).toBeCloseTo(0.298793);
    expect(grownNested.sizes[1]).toBeCloseTo(0.701207);

    const shrinkMiddle = resizePane(leftNestedTrifoldState(), "middle", {
      direction: "right",
      deltaPx: 100,
    });

    expect(shrinkMiddle.root.kind).toBe("split");
    expect(shrinkMiddle.root.sizes).toEqual([0.5, 0.5]);

    const shrunkNested = shrinkMiddle.root.children[0]!;
    expect(shrunkNested.kind).toBe("split");
    expect(shrunkNested.sizes[0]).toBeCloseTo(0.701207);
    expect(shrunkNested.sizes[1]).toBeCloseTo(0.298793);
  });

  it("resizes a middle pane against the right sibling boundary in a binary trifold", () => {
    const growMiddle = resizePane(nestedHorizontalState(), "middle", {
      direction: "right",
      deltaPx: 100,
    });

    expect(growMiddle.root.kind).toBe("split");
    expect(growMiddle.root.sizes).toEqual([0.5, 0.5]);

    const grownNested = growMiddle.root.children[1]!;
    expect(grownNested.kind).toBe("split");
    expect(grownNested.sizes[0]).toBeCloseTo(0.701207);
    expect(grownNested.sizes[1]).toBeCloseTo(0.298793);

    const shrinkMiddle = resizePane(nestedHorizontalState(), "middle", {
      direction: "left",
      deltaPx: 100,
    });

    expect(shrinkMiddle.root.kind).toBe("split");
    expect(shrinkMiddle.root.sizes).toEqual([0.5, 0.5]);

    const shrunkNested = shrinkMiddle.root.children[1]!;
    expect(shrunkNested.kind).toBe("split");
    expect(shrunkNested.sizes[0]).toBeCloseTo(0.298793);
    expect(shrunkNested.sizes[1]).toBeCloseTo(0.701207);
  });

  it("resizes edge panes by moving their sibling boundary", () => {
    const leftEdgeShrink = resizePane(horizontalSplitState(), "left", {
      direction: "left",
      deltaPx: 100,
    });

    expect(leftEdgeShrink.root.kind).toBe("split");
    expect(leftEdgeShrink.root.sizes[0]).toBeCloseTo(0.4);
    expect(leftEdgeShrink.root.sizes[1]).toBeCloseTo(0.6);

    const leftEdgeGrow = resizePane(horizontalSplitState(), "left", {
      direction: "right",
      deltaPx: 100,
    });

    expect(leftEdgeGrow.root.kind).toBe("split");
    expect(leftEdgeGrow.root.sizes[0]).toBeCloseTo(0.6);
    expect(leftEdgeGrow.root.sizes[1]).toBeCloseTo(0.4);

    const rightEdgeShrink = resizePane(horizontalSplitState(), "right", {
      direction: "right",
      deltaPx: 100,
    });

    expect(rightEdgeShrink.root.kind).toBe("split");
    expect(rightEdgeShrink.root.sizes[0]).toBeCloseTo(0.6);
    expect(rightEdgeShrink.root.sizes[1]).toBeCloseTo(0.4);

    const rightEdgeGrow = resizePane(horizontalSplitState(), "right", {
      direction: "left",
      deltaPx: 100,
    });

    expect(rightEdgeGrow.root.kind).toBe("split");
    expect(rightEdgeGrow.root.sizes[0]).toBeCloseTo(0.4);
    expect(rightEdgeGrow.root.sizes[1]).toBeCloseTo(0.6);

    const topEdgeShrink = resizePane(verticalSplitState(), "top", {
      direction: "up",
      deltaPx: 60,
    });

    expect(topEdgeShrink.root.kind).toBe("split");
    expect(topEdgeShrink.root.sizes[0]).toBeCloseTo(0.4);
    expect(topEdgeShrink.root.sizes[1]).toBeCloseTo(0.6);

    const topEdgeGrow = resizePane(verticalSplitState(), "top", {
      direction: "down",
      deltaPx: 60,
    });

    expect(topEdgeGrow.root.kind).toBe("split");
    expect(topEdgeGrow.root.sizes[0]).toBeCloseTo(0.6);
    expect(topEdgeGrow.root.sizes[1]).toBeCloseTo(0.4);

    const bottomEdgeShrink = resizePane(verticalSplitState(), "bottom", {
      direction: "down",
      deltaPx: 60,
    });

    expect(bottomEdgeShrink.root.kind).toBe("split");
    expect(bottomEdgeShrink.root.sizes[0]).toBeCloseTo(0.6);
    expect(bottomEdgeShrink.root.sizes[1]).toBeCloseTo(0.4);

    const bottomEdgeGrow = resizePane(verticalSplitState(), "bottom", {
      direction: "up",
      deltaPx: 60,
    });

    expect(bottomEdgeGrow.root.kind).toBe("split");
    expect(bottomEdgeGrow.root.sizes[0]).toBeCloseTo(0.4);
    expect(bottomEdgeGrow.root.sizes[1]).toBeCloseTo(0.6);
  });

  it("clamps pane resize to adjacent minimum sizes", () => {
    const controller = createFocusGridController({
      ...horizontalSplitState(),
      root: {
        kind: "split",
        id: "root",
        direction: "horizontal",
        sizes: [0.5, 0.5],
        children: [
          {
            kind: "pane",
            id: "left-node",
            paneId: "left",
            minWidth: 0,
          },
          {
            kind: "pane",
            id: "right-node",
            paneId: "right",
            minWidth: 400,
          },
        ],
      },
    });

    controller.api.resize("left", {
      direction: "right",
      deltaPx: 300,
    });

    const root = controller.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.6);
    expect(root.sizes[1]).toBeCloseTo(0.4);
  });

  it("uses the target split axis size for nested handle resize", () => {
    const controller = createFocusGridController(nestedHandleState());

    controller.api.resizeHandle("inner", {
      index: 0,
      deltaPx: 24,
      snapshotSizes: [0.5, 0.5],
    });

    const root = controller.getState().root;
    expect(root.kind).toBe("split");

    const inner = root.children[0]!;
    expect(inner.kind).toBe("split");
    expect(inner.sizes[0]).toBeCloseTo(0.596774);
    expect(inner.sizes[1]).toBeCloseTo(0.403226);
  });

  it("refits nested split sizes when resizing a parent handle", () => {
    const controller = createFocusGridController(nestedHandleWithPinnedChildState());
    const before = controller.getComputedLayout().panes;
    const beforeOne = before.find((pane) => pane.paneId === "one")!;
    const beforeTwo = before.find((pane) => pane.paneId === "two")!;
    const beforeThree = before.find((pane) => pane.paneId === "three")!;

    expect(beforeTwo.rect.width).toBeGreaterThanOrEqual(180);

    expect(
      controller.api.resizeHandle("root", {
        index: 0,
        deltaPx: -100,
        snapshotSizes: [0.75, 0.25],
      }),
    ).toBe(true);

    const root = controller.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.673077);
    expect(root.sizes[1]).toBeCloseTo(0.326923);

    const inner = root.children[0]!;
    expect(inner.kind).toBe("split");

    const after = controller.getComputedLayout().panes;
    const afterOne = after.find((pane) => pane.paneId === "one")!;
    const afterTwo = after.find((pane) => pane.paneId === "two")!;
    const afterThree = after.find((pane) => pane.paneId === "three")!;

    expect(afterThree.rect.width).toBeGreaterThan(beforeThree.rect.width);
    expect(afterTwo.rect.width).toBeGreaterThanOrEqual(180);
    expect(afterTwo.rect.width).toBeGreaterThanOrEqual(beforeTwo.rect.width - 20);
    expect(afterOne.rect.width).toBeLessThan(beforeOne.rect.width);
  });

  it("runs default pane resize commands against the active pane", () => {
    const controller = createFocusGridController(horizontalSplitState());

    expect(
      controller.commands.run("pane.resizeRight", controller, { deltaPx: 48 }),
    ).toBe(true);

    const root = controller.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.548);
    expect(root.sizes[1]).toBeCloseTo(0.452);
  });

  it("exposes scriptable pane resize and focus through controller.api", () => {
    const controller = createFocusGridController(horizontalSplitState());

    expect(
      controller.api.resize("left", { direction: "right", deltaPx: 100 }),
    ).toBe(true);
    expect(controller.api.focus("right")).toBe(true);
    expect(controller.getState().activePaneId).toBe("right");
    expect(controller.api.focus("missing")).toBe(false);
    expect(
      controller.api.resize("missing", { direction: "right", deltaPx: 100 }),
    ).toBe(false);
  });

  it("returns false and preserves state for no-op controller.api.resize calls", () => {
    const zeroDelta = createFocusGridController(horizontalSplitState());
    const beforeZeroDelta = zeroDelta.getState();

    expect(
      zeroDelta.api.resize("left", { direction: "right", deltaPx: 0 }),
    ).toBe(false);
    expect(zeroDelta.getState()).toBe(beforeZeroDelta);

    const noBoundary = createFocusGridController(horizontalSplitState());
    const beforeNoBoundary = noBoundary.getState();

    expect(
      noBoundary.api.resize("left", { direction: "up", deltaPx: 100 }),
    ).toBe(false);
    expect(noBoundary.getState()).toBe(beforeNoBoundary);

    const zeroContainer = createFocusGridController({
      ...horizontalSplitState(),
      container: {
        width: 0,
        height: 600,
      },
    });
    const beforeZeroContainer = zeroContainer.getState();

    expect(
      zeroContainer.api.resize("left", { direction: "right", deltaPx: 100 }),
    ).toBe(false);
    expect(zeroContainer.getState()).toBe(beforeZeroContainer);
  });

  it("treats negative controller.api.resize deltas as inverse movement", () => {
    const controller = createFocusGridController(horizontalSplitState());

    expect(
      controller.api.resize("left", { direction: "right", deltaPx: -100 }),
    ).toBe(true);

    const root = controller.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.4);
    expect(root.sizes[1]).toBeCloseTo(0.6);
  });

  it("keeps directional focus command-only instead of exposing it on controller.api", () => {
    const controller = createFocusGridController(horizontalSplitState());

    expect("focusDirection" in controller.api).toBe(false);
    expect(controller.commands.run("pane.focusRight", controller)).toBe(true);
    expect(controller.getState().activePaneId).toBe("right");
  });

  it("returns false and preserves state for no-op controller.api.focus calls", () => {
    const alreadyFocused = createFocusGridController(initialState());
    const beforeAlreadyFocused = alreadyFocused.getState();

    expect(alreadyFocused.api.focus("editor")).toBe(false);
    expect(alreadyFocused.getState()).toBe(beforeAlreadyFocused);

    const missing = createFocusGridController(initialState());
    const beforeMissing = missing.getState();

    expect(missing.api.focus("missing")).toBe(false);
    expect(missing.getState()).toBe(beforeMissing);

    const noActivePane = createFocusGridController({
      ...initialState(),
      activePaneId: null,
    });

    expect(noActivePane.api.focus("editor")).toBe(true);
    expect(noActivePane.getState().activePaneId).toBe("editor");
  });

  it("focuses horizontally adjacent panes", () => {
    const controller = createFocusGridController(horizontalSplitState());

    focusDirection(controller, "left", "right");

    expect(controller.getState().activePaneId).toBe("right");

    focusDirection(controller, "right", "left");

    expect(controller.getState().activePaneId).toBe("left");
  });

  it("focuses vertically adjacent panes", () => {
    const controller = createFocusGridController(verticalSplitState());

    focusDirection(controller, "bottom", "up");

    expect(controller.getState().activePaneId).toBe("top");

    focusDirection(controller, "top", "down");

    expect(controller.getState().activePaneId).toBe("bottom");
  });

  it("chooses the closest edge pane in a nested directional sibling", () => {
    const controller = createFocusGridController(nestedDirectionalFocusState());

    focusDirection(controller, "left", "right");

    expect(controller.getState().activePaneId).toBe("lower-right");
  });

  it("remembers the last focused pane inside an ambiguous directional split", () => {
    const controller = createFocusGridController(verticalMiddleTrifoldState());

    controller.api.focus("middle-top");
    focusDirection(controller, "middle-top", "left");
    focusDirection(controller, "left", "right");

    expect(controller.getState().activePaneId).toBe("middle-top");

    controller.api.focus("middle-bottom");
    focusDirection(controller, "middle-bottom", "right");
    focusDirection(controller, "right", "left");

    expect(controller.getState().activePaneId).toBe("middle-bottom");
  });

  it("keeps the closest entering edge ahead of remembered split focus", () => {
    const controller = createFocusGridController(horizontalTargetWithStaleMemoryState());

    focusDirection(controller, "left", "right");

    expect(controller.getState().activePaneId).toBe("near");
  });

  it("ignores stale split focus memory after a remembered pane is closed", () => {
    const controller = createFocusGridController(verticalMiddleTrifoldState());

    controller.api.focus("middle-top");
    controller.api.remove("middle-top");
    focusDirection(controller, "left", "right");

    expect(controller.getState().activePaneId).toBe("middle-bottom");
  });

  it("marks a newly split pane as focused in split memory", () => {
    const controller = createFocusGridController(verticalMiddleTrifoldState());

    controller.api.split("middle-top", {
      side: "down",
      newPaneId: "middle-top-bottom",
    });
    focusDirection(controller, "middle-top-bottom", "left");
    focusDirection(controller, "left", "right");

    expect(controller.getState().activePaneId).toBe("middle-top-bottom");
  });

  it("uses nested split memory when geometry would pick another pane in the branch", () => {
    const controller = createFocusGridController(verticalMiddleTrifoldState());

    controller.api.split("middle-top", {
      side: "down",
      newPaneId: "middle-top-bottom",
    });
    controller.api.focus("middle-top");
    focusDirection(controller, "middle-top", "left");
    focusDirection(controller, "left", "right");

    expect(controller.getState().activePaneId).toBe("middle-top");
  });

  it("returns the same state when no directional sibling matches", () => {
    const state = horizontalSplitState();
    const next = focusPaneInDirection(state, "left", "left");

    expect(next).toBe(state);
    expect(next.activePaneId).toBe("left");
  });

  it("runs default pane directional focus commands against the active pane", () => {
    const controller = createFocusGridController(horizontalSplitState());

    expect(controller.commands.run("pane.focusRight", controller)).toBe(true);

    expect(controller.getState().activePaneId).toBe("right");
  });

  it("runs default pane directional swap commands against the active pane", () => {
    const controller = createFocusGridController(horizontalSplitState());

    expect(controller.commands.run("pane.swapRight", controller)).toBe(true);

    const state = controller.getState();
    expect(state.activePaneId).toBe("left");
    expect(state.root.kind).toBe("split");
    expect(state.root.children[0]).toMatchObject({ paneId: "right" });
    expect(state.root.children[1]).toMatchObject({ paneId: "left" });
  });
});

function horizontalSplitState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      direction: "horizontal",
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
      direction: "vertical",
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

function leftNestedTrifoldState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      direction: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        {
          kind: "split",
          id: "nested",
          direction: "horizontal",
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
      direction: "horizontal",
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
          direction: "horizontal",
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
      direction: "horizontal",
      sizes: [0.25, 0.75],
      children: [
        {
          kind: "split",
          id: "inner",
          direction: "horizontal",
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
      direction: "horizontal",
      sizes: [0.75, 0.25],
      children: [
        {
          kind: "split",
          id: "inner",
          direction: "horizontal",
          sizes: [0.8, 0.2],
          children: [
            {
              kind: "pane",
              id: "one-node",
              paneId: "one",
              minWidth: 180,
            },
            {
              kind: "pane",
              id: "two-node",
              paneId: "two",
              minWidth: 180,
            },
          ],
        },
        {
          kind: "pane",
          id: "three-node",
          paneId: "three",
          minWidth: 180,
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
      direction: "horizontal",
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
          direction: "vertical",
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
      direction: "horizontal",
      sizes: [0.25, 0.5, 0.25],
      children: [
        {
          kind: "pane",
          id: "left-node",
          paneId: "left",
        },
        {
          kind: "split",
          id: "middle-split",
          direction: "vertical",
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
      direction: "horizontal",
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
          direction: "horizontal",
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

  it("creates the default pane keymap from the exported shortcut actions", () => {
    const keymap = createDefaultPaneKeymap();

    expect(keymap).toHaveLength(defaultPaneShortcutActions.length);
    expect(keymap).toContainEqual({
      sequence: parseKeySequence("Ctrl-B %"),
      action: "pane.splitRight",
      args: undefined,
      preventDefault: true,
      repeat: undefined,
    });
    expect(keymap).toContainEqual({
      sequence: parseKeySequence("Ctrl-B L"),
      action: "pane.resizeRight",
      args: { deltaPx: 48 },
      preventDefault: true,
      repeat: true,
    });
  });

  it("applies default pane keymap overrides and omits invalid or empty bindings", () => {
    const keymap = createDefaultPaneKeymap({
      overrides: {
        "split-right": "Ctrl-B R",
        close: "",
        "focus-left": "Ctrl+B",
        "focus-right": "Ctrl+",
      },
    });

    expect(
      keymap.find((binding) => binding.action === "pane.splitRight"),
    ).toMatchObject({
      sequence: parseKeySequence("Ctrl-B R"),
      action: "pane.splitRight",
    });
    expect(keymap.some((binding) => binding.action === "pane.close")).toBe(
      false,
    );
    expect(
      keymap.find((binding) => binding.action === "pane.focusLeft"),
    ).toMatchObject({
      sequence: parseKeySequence("Ctrl-B"),
      action: "pane.focusLeft",
    });
    expect(
      keymap.some((binding) => binding.action === "pane.focusRight"),
    ).toBe(false);
  });
});
