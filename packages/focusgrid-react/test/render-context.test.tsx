import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createWorkspace,
  type KeyBinding,
  type WorkspaceState,
} from "@focusgrid/core";
import {
  FocusGridProvider,
  FocusGrid,
  useFocusGridKeymap,
  useFocusGridWorkspace,
  type PaneRenderContext,
} from "../src/index";

function state(): WorkspaceState {
  return {
    root: {
      kind: "split",
      id: "root",
      direction: "horizontal",
      sizes: [1, 1],
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
    activePaneId: "right",
    container: {
      width: 800,
      height: 600,
    },
  };
}

describe("pane render context", () => {
  it("passes computed pane context to renderPane", () => {
    const workspace = createWorkspace(state());
    const contexts: PaneRenderContext[] = [];

    renderToStaticMarkup(
      <FocusGridProvider workspace={workspace}>
        <FocusGrid
          renderPane={(ctx) => {
            contexts.push(ctx);
            return <span>{ctx.paneId}</span>;
          }}
        />
      </FocusGridProvider>,
    );

    expect(contexts).toEqual([
      {
        paneId: "left",
        rect: { x: 0, y: 0, width: 397, height: 600 },
        active: false,
        workspace,
      },
      {
        paneId: "right",
        rect: { x: 403, y: 0, width: 397, height: 600 },
        active: true,
        workspace,
      },
    ]);
  });

  it("creates a workspace with useFocusGridWorkspace while keeping provider and root separate", () => {
    let workspaceFromHook: ReturnType<typeof createWorkspace> | null = null;

    function TestApp() {
      const workspace = useFocusGridWorkspace(state);
      workspaceFromHook = workspace;

      return (
        <FocusGridProvider workspace={workspace}>
          <FocusGrid renderPane={(ctx) => <span>{ctx.paneId}</span>} />
        </FocusGridProvider>
      );
    }

    const markup = renderToStaticMarkup(<TestApp />);

    expect(markup).toContain("<span>left</span>");
    expect(markup).toContain("<span>right</span>");
    expect(workspaceFromHook?.getState().activePaneId).toBe("right");
  });

  it("exposes the provider keymap to focus grids by default", () => {
    const workspace = createWorkspace(state());
    const keymap: KeyBinding[] = [
      {
        sequence: "x",
        command: "pane.close",
      },
    ];
    let keymapFromHook: KeyBinding[] | undefined;

    function TestApp() {
      keymapFromHook = useFocusGridKeymap();
      return <FocusGrid renderPane={(ctx) => <span>{ctx.paneId}</span>} />;
    }

    renderToStaticMarkup(
      <FocusGridProvider workspace={workspace} keymap={keymap}>
        <TestApp />
      </FocusGridProvider>,
    );

    expect(keymapFromHook).toBe(keymap);
  });
});
