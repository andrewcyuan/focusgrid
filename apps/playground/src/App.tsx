import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import {
  FocusGrid,
  FocusgridController,
  useFocusGridController,
  type Pane,
} from "@andrewcyuan/focusgrid/react";
import { useEffect, useRef, useState } from "react";

export function App() {
  const [domController] = useState(() => new FocusGridDomController());
  const controller = useFocusGridController(() => ({
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        { kind: "pane", id: "alpha-node", paneId: "alpha" },
        { kind: "pane", id: "beta-node", paneId: "beta" },
      ],
    },
    activePaneId: "alpha",
    container: { width: 0, height: 0 },
    minWidth: 140,
    minHeight: 100,
  }), domController);

  return (
    <FocusgridController.Provider value={{ controller, domController }}>
      <main>
        <header>
          <h1>Focusgrid</h1>
          <button onClick={() => controller.splitActive("right")}>Split right</button>
          <button onClick={() => controller.splitActive("down")}>Split down</button>
          <button onClick={() => controller.removeActive()}>Close pane</button>
          <a href="/">Reset</a>
        </header>
        <p>
          Click a pane to type. Drag a divider to resize. Press <kbd>Ctrl B</kbd>, then:
          {" "}<kbd>%</kbd> split right · <kbd>"</kbd> split down · <kbd>← ↑ ↓ →</kbd> focus ·
          {" "}<kbd>Shift + arrow</kbd> swap · <kbd>H J K L</kbd> resize · <kbd>X</kbd> close.
        </p>
        <FocusGrid renderPane={(pane) => <TextPane {...pane} />} />
      </main>
    </FocusgridController.Provider>
  );
}

function TextPane({ paneId, active }: Pane) {
  const editor = useRef<HTMLTextAreaElement>(null);

  // This demo sends focus to its editor when a pane becomes active.
  useEffect(() => {
    if (active) editor.current?.focus({ preventScroll: true });
  }, [active]);

  return (
    <section className="TextPane">
      <div className="TextPaneHeader">
        <strong>{paneId}</strong>
        <span>{active ? "active" : ""}</span>
      </div>
      <textarea
        ref={editor}
        aria-label={`Pane ${paneId}`}
        defaultValue={`Type here to test pane ${paneId}.`}
        spellCheck={false}
      />
    </section>
  );
}
