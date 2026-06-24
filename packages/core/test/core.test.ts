import { describe, expect, it } from "vitest";
import {
  KeyRouter,
  createWorkspace,
  parseKeySequence,
  reducer,
  swapPaneInDirection,
  swapPanes,
  type WorkspaceState,
} from "../src";

function initialState(): WorkspaceState {
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

describe("workspace", () => {
  it("splits panes and computes rectangles", () => {
    const workspace = createWorkspace(initialState());

    workspace.dispatch({
      type: "pane.split",
      paneId: "editor",
      direction: "horizontal",
      newPaneId: "terminal",
    });

    const state = workspace.getState();
    const layout = workspace.getComputedLayout();

    expect(state.root.kind).toBe("split");
    expect(state.activePaneId).toBe("terminal");
    expect(layout.panes).toHaveLength(2);
    expect(layout.handles).toHaveLength(1);
    expect(layout.panes[0]!.rect.width + layout.panes[1]!.rect.width + 6).toBe(
      1000,
    );
  });

  it("exposes scriptable split placement through workspace.api", () => {
    const right = createWorkspace(initialState());
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

    const left = createWorkspace(initialState());
    expect(left.api.split("editor", { side: "left", newPaneId: "nav" })).toBe(
      "nav",
    );
    expect(left.getState().root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      children: [{ paneId: "nav" }, { paneId: "editor" }],
    });

    const down = createWorkspace(initialState());
    expect(down.api.split("editor", { side: "down", newPaneId: "console" })).toBe(
      "console",
    );
    expect(down.getState().root).toMatchObject({
      kind: "split",
      direction: "vertical",
      children: [{ paneId: "editor" }, { paneId: "console" }],
    });

    const up = createWorkspace(initialState());
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
    const generated = createWorkspace(initialState());
    const newPaneId = generated.api.split("editor", { side: "right" });

    expect(newPaneId).toEqual(expect.stringMatching(/^pane-/));
    expect(generated.getState().activePaneId).toBe(newPaneId);
    expect(generated.getComputedLayout().panes.map((pane) => pane.paneId)).toContain(
      newPaneId,
    );

    const preserved = createWorkspace(initialState());
    expect(
      preserved.api.split("editor", {
        side: "right",
        newPaneId: "terminal",
        preserveActivePane: true,
      }),
    ).toBe("terminal");
    expect(preserved.getState().activePaneId).toBe("editor");
  });

  it("accepts option-shaped reducer actions for split and resize", () => {
    const split = reducer(initialState(), {
      type: "pane.split",
      paneId: "editor",
      options: {
        side: "left",
        newPaneId: "nav",
        preserveActivePane: true,
      },
    });

    expect(split.activePaneId).toBe("editor");
    expect(split.root).toMatchObject({
      kind: "split",
      direction: "horizontal",
      children: [{ paneId: "nav" }, { paneId: "editor" }],
    });

    const resized = reducer(horizontalSplitState(), {
      type: "pane.resize",
      paneId: "left",
      options: {
        direction: "right",
        deltaPx: 100,
      },
    });

    expect(resized.root.kind).toBe("split");
    expect(resized.root.sizes[0]).toBeCloseTo(0.6);
  });

  it("closes a pane and collapses a single-child split", () => {
    const workspace = createWorkspace(initialState());

    workspace.dispatch({
      type: "pane.split",
      paneId: "editor",
      direction: "horizontal",
      newPaneId: "terminal",
    });

    workspace.dispatch({
      type: "pane.close",
      paneId: "terminal",
    });

    expect(workspace.getState().root.kind).toBe("pane");
    expect(workspace.getState().activePaneId).toBe("editor");
  });

  it("exposes scriptable pane removal through workspace.api", () => {
    const removeActive = createWorkspace(horizontalSplitState());

    expect(removeActive.api.remove("left")).toBe(true);
    expect(removeActive.getState().root).toMatchObject({
      kind: "pane",
      paneId: "right",
    });
    expect(removeActive.getState().activePaneId).toBe("right");

    const removeInactive = createWorkspace(horizontalSplitState());
    expect(removeInactive.api.remove("right")).toBe(true);
    expect(removeInactive.getState().activePaneId).toBe("left");

    const missing = createWorkspace(horizontalSplitState());
    const beforeMissing = missing.getState();
    expect(missing.api.remove("missing")).toBe(false);
    expect(missing.getState()).toBe(beforeMissing);

    const last = createWorkspace(initialState());
    expect(last.api.remove("editor")).toBe(false);
    expect(last.getState().activePaneId).toBe("editor");
  });

  it("swaps pane content while preserving layout slots", () => {
    const workspace = createWorkspace({
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

    workspace.dispatch({
      type: "pane.swap",
      firstPaneId: "left",
      secondPaneId: "right",
    });

    const root = workspace.getState().root;
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

    const layout = workspace.getComputedLayout();
    const leftPane = layout.panes.find((pane) => pane.paneId === "left");
    const rightPane = layout.panes.find((pane) => pane.paneId === "right");
    expect(leftPane?.active).toBe(true);
    expect(leftPane!.rect.x).toBeGreaterThan(rightPane!.rect.x);
  });

  it("exposes scriptable pane swapping through workspace.api", () => {
    const workspace = createWorkspace(horizontalSplitState());

    expect(workspace.api.swap("left", "right")).toBe(true);
    expect(workspace.getState().activePaneId).toBe("left");
    expect(workspace.getState().root).toMatchObject({
      kind: "split",
      sizes: [0.5, 0.5],
      children: [
        { id: "left-node", paneId: "right" },
        { id: "right-node", paneId: "left" },
      ],
    });

    expect(workspace.api.swap("left", "left")).toBe(false);
    expect(workspace.api.swap("left", "missing")).toBe(false);
  });

  it("updates split focus memory after swapping the active pane", () => {
    const next = reducer(nestedHorizontalState(), {
      type: "pane.swap",
      firstPaneId: "left",
      secondPaneId: "middle",
    });

    expect(next.activePaneId).toBe("middle");
    expect(next.root.kind).toBe("split");
    expect(next.root.lastFocusedChildId).toBe("left-node");
  });

  it("swaps panes with the direct horizontal and vertical directional neighbors", () => {
    const horizontal = reducer(horizontalSplitState(), {
      type: "pane.swapDirection",
      paneId: "left",
      direction: "right",
    });

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

    const vertical = reducer(verticalSplitState(), {
      type: "pane.swapDirection",
      paneId: "bottom",
      direction: "up",
    });

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
    const focused = reducer(state, {
      type: "pane.focusDirection",
      paneId: "left",
      direction: "right",
    });
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
    const next = reducer(nestedDirectionalFocusState(), {
      type: "pane.swapDirection",
      paneId: "left",
      direction: "right",
    });

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
    expect(
      reducer(state, {
        type: "pane.swap",
        firstPaneId: "missing",
        secondPaneId: "right",
      }),
    ).toBe(state);
  });

  it("resizes a handle from a snapshot", () => {
    const workspace = createWorkspace(initialState());

    workspace.dispatch({
      type: "pane.split",
      paneId: "editor",
      direction: "horizontal",
      newPaneId: "terminal",
    });

    const split = workspace.getState().root;
    expect(split.kind).toBe("split");

    workspace.dispatch({
      type: "handle.resize",
      splitId: split.id,
      index: 0,
      deltaPx: 100,
      snapshotSizes: [0.5, 0.5],
    });

    const next = workspace.getState().root;
    expect(next.kind).toBe("split");
    expect(next.sizes[0]).toBeCloseTo(0.6);
    expect(next.sizes[1]).toBeCloseTo(0.4);
  });

  it("resizes a pane horizontally toward an adjacent pane", () => {
    const workspace = createWorkspace(horizontalSplitState());

    workspace.dispatch({
      type: "pane.resize",
      paneId: "left",
      direction: "right",
      deltaPx: 100,
    });

    const root = workspace.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.6);
    expect(root.sizes[1]).toBeCloseTo(0.4);
  });

  it("resizes a pane vertically toward an adjacent pane", () => {
    const workspace = createWorkspace(verticalSplitState());

    workspace.dispatch({
      type: "pane.resize",
      paneId: "bottom",
      direction: "up",
      deltaPx: 60,
    });

    const root = workspace.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.4);
    expect(root.sizes[1]).toBeCloseTo(0.6);
  });

  it("uses the nearest matching ancestor boundary for pane resize", () => {
    const workspace = createWorkspace(nestedHorizontalState());

    workspace.dispatch({
      type: "pane.resize",
      paneId: "middle",
      direction: "right",
      deltaPx: 100,
    });

    const root = workspace.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes).toEqual([0.5, 0.5]);

    const nested = root.children[1]!;
    expect(nested.kind).toBe("split");
    expect(nested.sizes[0]).toBeCloseTo(0.701207);
    expect(nested.sizes[1]).toBeCloseTo(0.298793);
  });

  it("resizes a middle pane against the left sibling boundary in a binary trifold", () => {
    const growMiddle = reducer(leftNestedTrifoldState(), {
      type: "pane.resize",
      paneId: "middle",
      direction: "left",
      deltaPx: 100,
    });

    expect(growMiddle.root.kind).toBe("split");
    expect(growMiddle.root.sizes).toEqual([0.5, 0.5]);

    const grownNested = growMiddle.root.children[0]!;
    expect(grownNested.kind).toBe("split");
    expect(grownNested.sizes[0]).toBeCloseTo(0.298793);
    expect(grownNested.sizes[1]).toBeCloseTo(0.701207);

    const shrinkMiddle = reducer(leftNestedTrifoldState(), {
      type: "pane.resize",
      paneId: "middle",
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
    const growMiddle = reducer(nestedHorizontalState(), {
      type: "pane.resize",
      paneId: "middle",
      direction: "right",
      deltaPx: 100,
    });

    expect(growMiddle.root.kind).toBe("split");
    expect(growMiddle.root.sizes).toEqual([0.5, 0.5]);

    const grownNested = growMiddle.root.children[1]!;
    expect(grownNested.kind).toBe("split");
    expect(grownNested.sizes[0]).toBeCloseTo(0.701207);
    expect(grownNested.sizes[1]).toBeCloseTo(0.298793);

    const shrinkMiddle = reducer(nestedHorizontalState(), {
      type: "pane.resize",
      paneId: "middle",
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
    const leftEdgeShrink = reducer(horizontalSplitState(), {
      type: "pane.resize",
      paneId: "left",
      direction: "left",
      deltaPx: 100,
    });

    expect(leftEdgeShrink.root.kind).toBe("split");
    expect(leftEdgeShrink.root.sizes[0]).toBeCloseTo(0.4);
    expect(leftEdgeShrink.root.sizes[1]).toBeCloseTo(0.6);

    const leftEdgeGrow = reducer(horizontalSplitState(), {
      type: "pane.resize",
      paneId: "left",
      direction: "right",
      deltaPx: 100,
    });

    expect(leftEdgeGrow.root.kind).toBe("split");
    expect(leftEdgeGrow.root.sizes[0]).toBeCloseTo(0.6);
    expect(leftEdgeGrow.root.sizes[1]).toBeCloseTo(0.4);

    const rightEdgeShrink = reducer(horizontalSplitState(), {
      type: "pane.resize",
      paneId: "right",
      direction: "right",
      deltaPx: 100,
    });

    expect(rightEdgeShrink.root.kind).toBe("split");
    expect(rightEdgeShrink.root.sizes[0]).toBeCloseTo(0.6);
    expect(rightEdgeShrink.root.sizes[1]).toBeCloseTo(0.4);

    const rightEdgeGrow = reducer(horizontalSplitState(), {
      type: "pane.resize",
      paneId: "right",
      direction: "left",
      deltaPx: 100,
    });

    expect(rightEdgeGrow.root.kind).toBe("split");
    expect(rightEdgeGrow.root.sizes[0]).toBeCloseTo(0.4);
    expect(rightEdgeGrow.root.sizes[1]).toBeCloseTo(0.6);

    const topEdgeShrink = reducer(verticalSplitState(), {
      type: "pane.resize",
      paneId: "top",
      direction: "up",
      deltaPx: 60,
    });

    expect(topEdgeShrink.root.kind).toBe("split");
    expect(topEdgeShrink.root.sizes[0]).toBeCloseTo(0.4);
    expect(topEdgeShrink.root.sizes[1]).toBeCloseTo(0.6);

    const topEdgeGrow = reducer(verticalSplitState(), {
      type: "pane.resize",
      paneId: "top",
      direction: "down",
      deltaPx: 60,
    });

    expect(topEdgeGrow.root.kind).toBe("split");
    expect(topEdgeGrow.root.sizes[0]).toBeCloseTo(0.6);
    expect(topEdgeGrow.root.sizes[1]).toBeCloseTo(0.4);

    const bottomEdgeShrink = reducer(verticalSplitState(), {
      type: "pane.resize",
      paneId: "bottom",
      direction: "down",
      deltaPx: 60,
    });

    expect(bottomEdgeShrink.root.kind).toBe("split");
    expect(bottomEdgeShrink.root.sizes[0]).toBeCloseTo(0.6);
    expect(bottomEdgeShrink.root.sizes[1]).toBeCloseTo(0.4);

    const bottomEdgeGrow = reducer(verticalSplitState(), {
      type: "pane.resize",
      paneId: "bottom",
      direction: "up",
      deltaPx: 60,
    });

    expect(bottomEdgeGrow.root.kind).toBe("split");
    expect(bottomEdgeGrow.root.sizes[0]).toBeCloseTo(0.4);
    expect(bottomEdgeGrow.root.sizes[1]).toBeCloseTo(0.6);
  });

  it("clamps pane resize to adjacent minimum sizes", () => {
    const workspace = createWorkspace({
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

    workspace.dispatch({
      type: "pane.resize",
      paneId: "left",
      direction: "right",
      deltaPx: 300,
    });

    const root = workspace.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.6);
    expect(root.sizes[1]).toBeCloseTo(0.4);
  });

  it("uses the target split axis size for nested handle resize", () => {
    const workspace = createWorkspace(nestedHandleState());

    workspace.dispatch({
      type: "handle.resize",
      splitId: "inner",
      index: 0,
      deltaPx: 24,
      snapshotSizes: [0.5, 0.5],
    });

    const root = workspace.getState().root;
    expect(root.kind).toBe("split");

    const inner = root.children[0]!;
    expect(inner.kind).toBe("split");
    expect(inner.sizes[0]).toBeCloseTo(0.596774);
    expect(inner.sizes[1]).toBeCloseTo(0.403226);
  });

  it("runs default pane resize commands against the active pane", () => {
    const workspace = createWorkspace(horizontalSplitState());

    expect(
      workspace.commands.run("pane.resizeRight", workspace, { deltaPx: 48 }),
    ).toBe(true);

    const root = workspace.getState().root;
    expect(root.kind).toBe("split");
    expect(root.sizes[0]).toBeCloseTo(0.548);
    expect(root.sizes[1]).toBeCloseTo(0.452);
  });

  it("exposes scriptable pane resize and focus through workspace.api", () => {
    const workspace = createWorkspace(horizontalSplitState());

    expect(workspace.api.resize("left", { direction: "right", deltaPx: 100 })).toBe(
      true,
    );
    expect(workspace.api.focus("right")).toBe(true);
    expect(workspace.getState().activePaneId).toBe("right");
    expect(workspace.api.focusDirection("left")).toBe(true);
    expect(workspace.getState().activePaneId).toBe("left");
    expect(workspace.api.focus("missing")).toBe(false);
    expect(
      workspace.api.resize("missing", { direction: "right", deltaPx: 100 }),
    ).toBe(false);
  });

  it("focuses horizontally adjacent panes", () => {
    const workspace = createWorkspace(horizontalSplitState());

    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "left",
      direction: "right",
    });

    expect(workspace.getState().activePaneId).toBe("right");

    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "right",
      direction: "left",
    });

    expect(workspace.getState().activePaneId).toBe("left");
  });

  it("focuses vertically adjacent panes", () => {
    const workspace = createWorkspace(verticalSplitState());

    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "bottom",
      direction: "up",
    });

    expect(workspace.getState().activePaneId).toBe("top");

    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "top",
      direction: "down",
    });

    expect(workspace.getState().activePaneId).toBe("bottom");
  });

  it("chooses the closest edge pane in a nested directional sibling", () => {
    const workspace = createWorkspace(nestedDirectionalFocusState());

    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "left",
      direction: "right",
    });

    expect(workspace.getState().activePaneId).toBe("lower-right");
  });

  it("remembers the last focused pane inside an ambiguous directional split", () => {
    const workspace = createWorkspace(verticalMiddleTrifoldState());

    workspace.dispatch({
      type: "pane.focus",
      paneId: "middle-top",
    });
    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "middle-top",
      direction: "left",
    });
    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "left",
      direction: "right",
    });

    expect(workspace.getState().activePaneId).toBe("middle-top");

    workspace.dispatch({
      type: "pane.focus",
      paneId: "middle-bottom",
    });
    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "middle-bottom",
      direction: "right",
    });
    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "right",
      direction: "left",
    });

    expect(workspace.getState().activePaneId).toBe("middle-bottom");
  });

  it("keeps the closest entering edge ahead of remembered split focus", () => {
    const workspace = createWorkspace(horizontalTargetWithStaleMemoryState());

    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "left",
      direction: "right",
    });

    expect(workspace.getState().activePaneId).toBe("near");
  });

  it("ignores stale split focus memory after a remembered pane is closed", () => {
    const workspace = createWorkspace(verticalMiddleTrifoldState());

    workspace.dispatch({
      type: "pane.focus",
      paneId: "middle-top",
    });
    workspace.dispatch({
      type: "pane.close",
      paneId: "middle-top",
    });
    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "left",
      direction: "right",
    });

    expect(workspace.getState().activePaneId).toBe("middle-bottom");
  });

  it("marks a newly split pane as focused in split memory", () => {
    const workspace = createWorkspace(verticalMiddleTrifoldState());

    workspace.dispatch({
      type: "pane.split",
      paneId: "middle-top",
      direction: "vertical",
      newPaneId: "middle-top-bottom",
    });
    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "middle-top-bottom",
      direction: "left",
    });
    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "left",
      direction: "right",
    });

    expect(workspace.getState().activePaneId).toBe("middle-top-bottom");
  });

  it("uses nested split memory when geometry would pick another pane in the branch", () => {
    const workspace = createWorkspace(verticalMiddleTrifoldState());

    workspace.dispatch({
      type: "pane.split",
      paneId: "middle-top",
      direction: "vertical",
      newPaneId: "middle-top-bottom",
    });
    workspace.dispatch({
      type: "pane.focus",
      paneId: "middle-top",
    });
    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "middle-top",
      direction: "left",
    });
    workspace.dispatch({
      type: "pane.focusDirection",
      paneId: "left",
      direction: "right",
    });

    expect(workspace.getState().activePaneId).toBe("middle-top");
  });

  it("returns the same state when no directional sibling matches", () => {
    const state = horizontalSplitState();
    const next = reducer(state, {
      type: "pane.focusDirection",
      paneId: "left",
      direction: "left",
    });

    expect(next).toBe(state);
    expect(next.activePaneId).toBe("left");
  });

  it("runs default pane directional focus commands against the active pane", () => {
    const workspace = createWorkspace(horizontalSplitState());

    expect(workspace.commands.run("pane.focusRight", workspace)).toBe(true);

    expect(workspace.getState().activePaneId).toBe("right");
  });

  it("runs default pane directional swap commands against the active pane", () => {
    const workspace = createWorkspace(horizontalSplitState());

    expect(workspace.commands.run("pane.swapRight", workspace)).toBe(true);

    const state = workspace.getState();
    expect(state.activePaneId).toBe("left");
    expect(state.root.kind).toBe("split");
    expect(state.root.children[0]).toMatchObject({ paneId: "right" });
    expect(state.root.children[1]).toMatchObject({ paneId: "left" });
  });
});

function horizontalSplitState(): WorkspaceState {
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

function verticalSplitState(): WorkspaceState {
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

function leftNestedTrifoldState(): WorkspaceState {
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

function nestedHorizontalState(): WorkspaceState {
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

function nestedHandleState(): WorkspaceState {
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

function nestedDirectionalFocusState(): WorkspaceState {
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

function verticalMiddleTrifoldState(): WorkspaceState {
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

function horizontalTargetWithStaleMemoryState(): WorkspaceState {
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
  it("parses multi-stroke shortcuts and matches them through the router", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-B %"),
        command: "pane.splitRight",
      },
    ]);

    const ctx = {
      activePaneId: "editor",
      inputFocused: false,
      mode: "normal" as const,
    };

    expect(router.handle(parseKeySequence("Ctrl-B")[0]!, ctx)).toEqual({
      matched: false,
      pending: true,
    });

    expect(router.handle(parseKeySequence("%")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      command: "pane.splitRight",
      args: undefined,
      preventDefault: true,
    });
  });

  it("consumes an invalid continuation after a pending shortcut prefix", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-B %"),
        command: "pane.splitRight",
      },
    ]);

    const ctx = {
      activePaneId: "editor",
      inputFocused: true,
      mode: "normal" as const,
    };

    expect(router.handle(parseKeySequence("Ctrl-B")[0]!, ctx)).toEqual({
      matched: false,
      pending: true,
    });

    expect(router.handle(parseKeySequence("Z")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: true,
    });

    expect(router.handle(parseKeySequence("Z")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: false,
    });
  });

  it("uses dashes for modifier key syntax and normalizes arrow aliases", () => {
    expect(parseKeySequence("Ctrl-Shift-B Arrow-Left ArrowRight Ctrl-+ -")).toEqual([
      {
        key: "b",
        ctrl: true,
        meta: false,
        alt: false,
        shift: true,
      },
      {
        key: "left",
        ctrl: false,
        meta: false,
        alt: false,
        shift: false,
      },
      {
        key: "right",
        ctrl: false,
        meta: false,
        alt: false,
        shift: false,
      },
      {
        key: "+",
        ctrl: true,
        meta: false,
        alt: false,
        shift: false,
      },
      {
        key: "-",
        ctrl: false,
        meta: false,
        alt: false,
        shift: false,
      },
    ]);

    expect(() => parseKeySequence("Ctrl+B")).toThrow(
      "Invalid key stroke: Ctrl+B",
    );
  });

  it("retains a repeatable leader so different followers can run during the repeat window", () => {
    let now = 1000;
    const router = new KeyRouter(
      [
        {
          sequence: parseKeySequence("Ctrl-B L"),
          command: "pane.resizeRight",
          args: { deltaPx: 4 },
          repeat: true,
        },
        {
          sequence: parseKeySequence("Ctrl-B H"),
          command: "pane.resizeLeft",
          args: { deltaPx: 4 },
          repeat: true,
        },
      ],
      {
        repeatTimeoutMs: 300,
        now: () => now,
      },
    );
    const ctx = {
      activePaneId: "editor",
      inputFocused: true,
      mode: "normal" as const,
    };

    expect(router.handle(parseKeySequence("Ctrl-B")[0]!, ctx)).toEqual({
      matched: false,
      pending: true,
    });

    expect(router.handle(parseKeySequence("L")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      command: "pane.resizeRight",
      args: { deltaPx: 4 },
      preventDefault: true,
    });

    now += 250;

    expect(router.handle(parseKeySequence("L")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      command: "pane.resizeRight",
      args: { deltaPx: 4 },
      preventDefault: true,
    });

    now += 250;

    expect(router.handle(parseKeySequence("H")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      command: "pane.resizeLeft",
      args: { deltaPx: 4 },
      preventDefault: true,
    });

    now += 250;

    expect(router.handle(parseKeySequence("H")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      command: "pane.resizeLeft",
      args: { deltaPx: 4 },
      preventDefault: true,
    });
  });

  it("does not run a different follower after the repeat window expires", () => {
    let now = 1000;
    const router = new KeyRouter(
      [
        {
          sequence: parseKeySequence("Ctrl-B L"),
          command: "pane.resizeRight",
          repeat: true,
        },
        {
          sequence: parseKeySequence("Ctrl-B H"),
          command: "pane.resizeLeft",
          repeat: true,
        },
      ],
      {
        repeatTimeoutMs: 300,
        now: () => now,
      },
    );
    const ctx = {
      activePaneId: "editor",
      inputFocused: true,
      mode: "normal" as const,
    };

    router.handle(parseKeySequence("Ctrl-B")[0]!, ctx);

    expect(router.handle(parseKeySequence("L")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      command: "pane.resizeRight",
      args: undefined,
      preventDefault: true,
    });

    now += 301;

    expect(router.handle(parseKeySequence("H")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: false,
    });
  });

  it("does not repeat non-repeatable sequence followers", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-B X"),
        command: "pane.close",
      },
    ]);
    const ctx = {
      activePaneId: "editor",
      inputFocused: true,
      mode: "normal" as const,
    };

    router.handle(parseKeySequence("Ctrl-B")[0]!, ctx);

    expect(router.handle(parseKeySequence("X")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      command: "pane.close",
      args: undefined,
      preventDefault: true,
    });

    expect(router.handle(parseKeySequence("X")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: false,
    });
  });

  it("does not run non-repeatable bindings from a retained leader", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-B L"),
        command: "pane.resizeRight",
        repeat: true,
      },
      {
        sequence: parseKeySequence("Ctrl-B X"),
        command: "pane.close",
      },
    ]);
    const ctx = {
      activePaneId: "editor",
      inputFocused: true,
      mode: "normal" as const,
    };

    router.handle(parseKeySequence("Ctrl-B")[0]!, ctx);
    router.handle(parseKeySequence("L")[0]!, ctx);

    expect(router.handle(parseKeySequence("X")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: true,
    });

    expect(router.handle(parseKeySequence("L")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: false,
    });
  });

  it("cancels a retained leader after an unmatched follower", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-B L"),
        command: "pane.resizeRight",
        repeat: true,
      },
    ]);
    const ctx = {
      activePaneId: "editor",
      inputFocused: true,
      mode: "normal" as const,
    };

    router.handle(parseKeySequence("Ctrl-B")[0]!, ctx);
    router.handle(parseKeySequence("L")[0]!, ctx);

    expect(router.handle(parseKeySequence("Z")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: true,
    });

    expect(router.handle(parseKeySequence("L")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: false,
    });
  });
});
