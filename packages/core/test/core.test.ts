import { describe, expect, it } from "vitest";
import {
  KeyRouter,
  createWorkspace,
  parseKeySequence,
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
});

describe("keyboard", () => {
  it("parses multi-stroke shortcuts and matches them through the router", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl+B %"),
        command: "pane.splitRight",
      },
    ]);

    const ctx = {
      activePaneId: "editor",
      inputFocused: false,
      mode: "normal" as const,
    };

    expect(router.handle(parseKeySequence("Ctrl+B")[0]!, ctx)).toEqual({
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
});
