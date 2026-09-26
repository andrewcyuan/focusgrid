import type { ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FocusGridController, type FocusGridControllerState } from "@andrewcyuan/focusgrid/core";
import { FocusgridController, FocusGrid, useControllerLayout, useFocusGridController, type Pane } from "../src/index";

function state(): FocusGridControllerState {
  return {
    root: { kind: "split", id: "root", orientation: "horizontal", sizes: [1, 1], children: [
      { kind: "pane", id: "left-node", paneId: "left" },
      { kind: "pane", id: "right-node", paneId: "right" },
    ] },
    activePaneId: "right", container: { width: 800, height: 600 },
  };
}

function controllers() {
  const domController = new FocusGridDomController();
  return { controller: new FocusGridController(state(), domController), domController };
}

describe("pane render context", () => {
  it("passes computed pane geometry and the context controller to renderPane", () => {
    const value = controllers();
    const panes: Pane[] = [];
    renderToStaticMarkup(
      <FocusgridController.Provider value={value}>
        <FocusGrid renderPane={pane => { panes.push(pane); return <span>{pane.paneId}</span>; }} />
      </FocusgridController.Provider>,
    );
    expect(panes).toEqual([
      { paneId: "left", rect: { x: 0, y: 0, width: 398, height: 600 }, active: false, controller: value.controller },
      { paneId: "right", rect: { x: 401, y: 0, width: 399, height: 600 }, active: true, controller: value.controller },
    ]);
  });

  it("creates the controller in the app and supplies it through context", () => {
    const domController = new FocusGridDomController();
    function App() {
      const controller = useFocusGridController(state, domController);
      return <FocusgridController.Provider value={{ controller, domController }}>
        <FocusGrid renderPane={({ paneId }) => <span>{paneId}</span>} />
      </FocusgridController.Provider>;
    }
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain("<span>left</span>");
    expect(markup).toContain("<span>right</span>");
  });

  it("reads computed layout from the supplied controller hook", () => {
    const { controller } = controllers();
    let activePaneId: string | undefined;
    function App() {
      activePaneId = useControllerLayout(controller).panes.find(pane => pane.active)?.paneId;
      return null;
    }
    renderToStaticMarkup(<App />);
    expect(activePaneId).toBe("right");
  });

  it("renders mixed recursive splits and their separators", () => {
    const value = controllers();
    value.controller.split("left-node", { side: "down", newPaneId: "bottom" });
    const markup = renderToStaticMarkup(
      <FocusgridController.Provider value={value}>
        <FocusGrid renderPane={({ paneId }) => <span>{paneId}</span>} />
      </FocusgridController.Provider>,
    );
    expect(markup.match(/data-pane-id=/g)).toHaveLength(3);
    expect(markup.match(/role="separator"/g)).toHaveLength(2);
    expect(markup).toContain('data-direction="horizontal"');
    expect(markup).toContain('data-direction="vertical"');
    expect(markup.indexOf("<span>left</span>")).toBeLessThan(markup.indexOf("<span>bottom</span>"));
    expect(markup.indexOf("<span>bottom</span>")).toBeLessThan(markup.indexOf("<span>right</span>"));
  });

  it("accepts a custom keymap without browser effects during server rendering", () => {
    const keymap: ShortcutBinding[] = [{ sequence: "Ctrl-K", action: () => {} }];
    const markup = renderToStaticMarkup(
      <FocusgridController.Provider value={controllers()}>
        <FocusGrid keymap={keymap} renderPane={({ paneId }) => <span>{paneId}</span>} />
      </FocusgridController.Provider>,
    );
    expect(markup).toContain("<span>left</span>");
  });

  it("requires an explicit provider instead of constructing a hidden controller", () => {
    expect(() => renderToStaticMarkup(<FocusGrid renderPane={() => null} />)).toThrow("FocusgridController provider");
  });
});
