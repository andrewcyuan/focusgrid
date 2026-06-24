import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createWorkspace, type WorkspaceState } from "@focusgrid/core";
import {
  PaneProvider,
  PaneRoot,
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
      <PaneProvider workspace={workspace}>
        <PaneRoot
          renderPane={(ctx) => {
            contexts.push(ctx);
            return <span>{ctx.paneId}</span>;
          }}
        />
      </PaneProvider>,
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
});
