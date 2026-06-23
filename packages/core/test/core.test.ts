import { describe, expect, it } from "vitest";
import {
  KeyRouter,
  createWorkspace,
  parseKeySequence,
  reducer,
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
