import { type ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FocusGridController, type FocusGridControllerState } from "@andrewcyuan/focusgrid/core";
import { FocusGrid, useControllerLayout, useFocusGridController, type Pane } from "../src/index";

function state(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
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
    const domController = new FocusGridDomController();
    const controller = new FocusGridController(state(), domController);
    const contexts: Pane[] = [];

    renderToStaticMarkup(
      <>
        <FocusGrid domController={domController}
        controller={controller}
        renderPane={(ctx) => {
          contexts.push(ctx);
          return <span>{ctx.paneId}</span>;
        }}
      />
      </>,
    );

    expect(contexts).toEqual([
      {
        paneId: "left",
        rect: { x: 0, y: 0, width: 398, height: 600 },
        active: false,
        controller,
      },
      {
        paneId: "right",
        rect: { x: 401, y: 0, width: 399, height: 600 },
        active: true,
        controller,
      },
    ]);
  });

  it("creates a stable controller with useFocusGridController", () => {
    let controllerFromHook: FocusGridController | null =
      null;
    const domController = new FocusGridDomController();

    function TestApp() {
      const controller = useFocusGridController(state, domController);
      controllerFromHook = controller;

      return (
        <>
        <FocusGrid domController={domController}
          controller={controller}
          renderPane={(ctx) => <span>{ctx.paneId}</span>}
        />
      </>
      );
    }

    const markup = renderToStaticMarkup(<TestApp />);

    expect(markup).toContain("<span>left</span>");
    expect(markup).toContain("<span>right</span>");
    expect(controllerFromHook?.getLayout().panes.find(pane => pane.active)?.paneId).toBe("right");
  });

  it("reads computed layout from the supplied controller hook", () => {
    const domController = new FocusGridDomController();
    const controller = new FocusGridController(state(), domController);
    let activePaneId: string | null | undefined;

    function TestApp() {
      activePaneId = useControllerLayout(controller).panes.find(pane => pane.active)?.paneId;
      return null;
    }

    renderToStaticMarkup(<TestApp />);

    expect(activePaneId).toBe("right");
  });

  it("notifies subscribers after controller api mutations", () => {
    const domController = new FocusGridDomController();
    const controller = new FocusGridController(state(), domController);
    const listenerCalls: Array<string | null> = [];
    const transitions: Array<[string | null, string | null]> = [];
    const unsubscribe = controller.subscribe((nextState, previousState) => {
      listenerCalls.push(nextState.activePaneId);
      transitions.push([previousState.activePaneId, nextState.activePaneId]);
    });

    controller.focus("left");
    unsubscribe();
    controller.focus("right");

    expect(listenerCalls).toEqual(["left"]);
    expect(transitions).toEqual([["right", "left"]]);
  });

  it("accepts a callback keymap", () => {
    const domController = new FocusGridDomController();
    const controller = new FocusGridController(state(), domController);
    const keymap: ShortcutBinding[] = [
      {
        sequence: "Ctrl-K",
        action: () => {},
      },
    ];

    const markup = renderToStaticMarkup(
      <>
        <FocusGrid domController={domController}
        controller={controller}
        keymap={keymap}
        renderPane={(ctx) => <span>{ctx.paneId}</span>}
      />
      </>,
    );

    expect(markup).toContain("<span>left</span>");
    expect(markup).toContain("<span>right</span>");
  });

});
