import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createFocusGridController,
  type KeyBinding,
  type FocusGridControllerState,
} from "@focusgrid/core";
import {
  FocusGrid,
  useControllerState,
  useFocusGridController,
  type PaneRenderContext,
} from "../src/index";

function state(): FocusGridControllerState {
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
    const controller = createFocusGridController(state());
    const contexts: PaneRenderContext[] = [];

    renderToStaticMarkup(
      <FocusGrid
        controller={controller}
        renderPane={(ctx) => {
          contexts.push(ctx);
          return <span>{ctx.paneId}</span>;
        }}
      />,
    );

    expect(contexts).toEqual([
      {
        paneId: "left",
        rect: { x: 0, y: 0, width: 397, height: 600 },
        active: false,
        controller,
      },
      {
        paneId: "right",
        rect: { x: 403, y: 0, width: 397, height: 600 },
        active: true,
        controller,
      },
    ]);
  });

  it("creates a stable controller with useFocusGridController", () => {
    let controllerFromHook: ReturnType<typeof createFocusGridController> | null =
      null;

    function TestApp() {
      const controller = useFocusGridController(state);
      controllerFromHook = controller;

      return (
        <FocusGrid
          controller={controller}
          renderPane={(ctx) => <span>{ctx.paneId}</span>}
        />
      );
    }

    const markup = renderToStaticMarkup(<TestApp />);

    expect(markup).toContain("<span>left</span>");
    expect(markup).toContain("<span>right</span>");
    expect(controllerFromHook?.getState().activePaneId).toBe("right");
  });

  it("reads state from the supplied controller hook", () => {
    const controller = createFocusGridController(state());
    let activePaneId: string | null | undefined;

    function TestApp() {
      activePaneId = useControllerState(controller).activePaneId;
      return null;
    }

    renderToStaticMarkup(<TestApp />);

    expect(activePaneId).toBe("right");
  });

  it("notifies subscribers after controller api mutations", () => {
    const controller = createFocusGridController(state());
    const listenerCalls: Array<string | null> = [];
    const unsubscribe = controller.subscribe(() => {
      listenerCalls.push(controller.getState().activePaneId);
    });

    controller.api.focus("left");
    unsubscribe();
    controller.api.focus("right");

    expect(listenerCalls).toEqual(["left"]);
  });

  it("accepts a component-level keymap without context", () => {
    const controller = createFocusGridController(state());
    const keymap: KeyBinding[] = [
      {
        sequence: [],
        action: "pane.close",
      },
    ];

    const markup = renderToStaticMarkup(
      <FocusGrid
        controller={controller}
        keymap={keymap}
        renderPane={(ctx) => <span>{ctx.paneId}</span>}
      />,
    );

    expect(markup).toContain("<span>left</span>");
    expect(markup).toContain("<span>right</span>");
  });
});
