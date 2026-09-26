import { type ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FocusGridController, type FocusGridControllerState } from "@andrewcyuan/focusgrid/core";
import { FocusGrid, useControllerState, useFocusGridController, type Pane } from "../src/index";

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
    const controller = new FocusGridController(state(), new FocusGridDomController());
    const contexts: Pane[] = [];

    renderToStaticMarkup(
      <>
        <FocusGrid domController={new FocusGridDomController()}
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

    function TestApp() {
      const controller = useFocusGridController(state, new FocusGridDomController());
      controllerFromHook = controller;

      return (
        <>
        <FocusGrid domController={new FocusGridDomController()}
          controller={controller}
          renderPane={(ctx) => <span>{ctx.paneId}</span>}
        />
      </>
      );
    }

    const markup = renderToStaticMarkup(<TestApp />);

    expect(markup).toContain("<span>left</span>");
    expect(markup).toContain("<span>right</span>");
    expect(controllerFromHook?.state.activePaneId).toBe("right");
  });

  it("reads state from the supplied controller hook", () => {
    const controller = new FocusGridController(state(), new FocusGridDomController());
    let activePaneId: string | null | undefined;

    function TestApp() {
      activePaneId = useControllerState(controller).activePaneId;
      return null;
    }

    renderToStaticMarkup(<TestApp />);

    expect(activePaneId).toBe("right");
  });

  it("notifies subscribers after controller api mutations", () => {
    const controller = new FocusGridController(state(), new FocusGridDomController());
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

  it("accepts a callback keymap inside the shared provider", () => {
    const controller = new FocusGridController(state(), new FocusGridDomController());
    const keymap: ShortcutBinding[] = [
      {
        sequence: "Ctrl-K",
        action: () => {},
      },
    ];

    const markup = renderToStaticMarkup(
      <>
        <FocusGrid domController={new FocusGridDomController()}
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
