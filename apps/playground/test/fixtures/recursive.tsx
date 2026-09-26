import { StrictMode, useContext, useState } from "react";
import { createRoot } from "react-dom/client";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { FocusGrid, FocusgridController, useControllerLayout, useFocusGridController } from "@andrewcyuan/focusgrid/react";
import "@andrewcyuan/focusgrid/react/styles.css";

function Status({ name }: { name: string }) {
  const { controller } = useContext(FocusgridController)!;
  const layout = useControllerLayout(controller);
  return <output aria-label={`${name}-active`}>{layout.panes.find(pane => pane.active)?.paneId}</output>;
}

function InnerGrid() {
  const [domController] = useState(() => new FocusGridDomController());
  const controller = useFocusGridController(() => ({
    root: { kind: "split", id: "inner-split", orientation: "horizontal", sizes: [0.5, 0.5], children: [
      { kind: "pane", id: "inner-a", paneId: "a" },
      { kind: "pane", id: "inner-b", paneId: "b" },
    ] }, activePaneId: "a", container: { width: 0, height: 0 }, minWidth: 50,
  }), domController);
  return <FocusgridController.Provider value={{ controller, domController }}>
    <Status name="inner" />
    <div style={{ height: 150 }}>
      <FocusGrid className="inner-grid" renderPane={({ paneId }) => <textarea aria-label={`inner-${paneId}`} defaultValue="nested" />} />
    </div>
  </FocusgridController.Provider>;
}

function App() {
  const [domController] = useState(() => new FocusGridDomController());
  const controller = useFocusGridController(() => ({
    root: { kind: "split", id: "outer-split", orientation: "horizontal", sizes: [0.3, 0.7], children: [
      { kind: "pane", id: "a-node", paneId: "a" },
      { kind: "pane", id: "b-node", paneId: "b" },
    ] }, activePaneId: "a", container: { width: 0, height: 0 }, minWidth: 90, minHeight: 60,
  }), domController);
  const [closed, setClosed] = useState(0);
  const split = () => controller.split(controller.getPane("a")!.id, {
    side: "down", newPaneId: "c", newPaneNodeId: "c-node", splitId: "vertical", preserveActivePane: true,
  });
  return <FocusgridController.Provider value={{ controller, domController }}>
    <button onClick={split}>Split a</button>
    <button onClick={() => controller.remove("c")}>Remove c</button>
    <button onClick={() => controller.swap("a", "b")}>Swap a b</button>
    <button onClick={() => { split(); controller.remove("c"); }}>Create and close c</button>
    <Status name="outer" />
    <output aria-label="closed-count">{closed}</output>
    <div style={{ width: 800, height: 400 }}>
      <FocusGrid className="outer-grid" onPaneClose={() => setClosed(value => value + 1)} renderPane={({ paneId }) => <>
        <textarea aria-label={`outer-${paneId}`} defaultValue="abcdef" />
        {paneId === "b" && <InnerGrid />}
      </>} />
    </div>
  </FocusgridController.Provider>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
