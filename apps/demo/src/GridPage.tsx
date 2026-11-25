import { useEffect, useRef } from "react";
import {
  FocusGrid,
  FocusgridController,
  createDefaultPaneKeymap,
  useFocusGridController,
  type Pane,
  type PaneShortcutId,
} from "@andrewcyuan/focusgrid/react";
import { actionLabel, loadKeybinds } from "./keybinds";

export function GridPage() {
  const controllers = useFocusGridController(() => ({
    root: {
      kind: "split",
      id: "root",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        { kind: "pane", id: "one-node", paneId: "one" },
        { kind: "pane", id: "two-node", paneId: "two" },
      ],
    },
    activePaneId: "one",
    container: { width: 0, height: 0 },
    minWidth: 140,
    minHeight: 100,
  }));
  const keybinds = loadKeybinds();

  return (
    <main className="grid-page">
      <details>
        <summary>Keybinds</summary>
        <dl>
          {Object.entries(keybinds).map(([id, sequence]) => (
            <div key={id}>
              <dt>{actionLabel(id as PaneShortcutId)}</dt>
              <dd>
                <kbd>{sequence}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <div className="grid">
        <FocusgridController.Provider value={controllers}>
          <FocusGrid
            keymap={createDefaultPaneKeymap(controllers.controller, keybinds)}
            renderPane={(pane) => <TextPane {...pane} />}
          />
        </FocusgridController.Provider>
      </div>
    </main>
  );
}

function TextPane({ paneId, active }: Pane) {
  const editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (active) editor.current?.focus({ preventScroll: true });
  }, [active]);
  return <textarea ref={editor} className="pane" aria-label={`Pane ${paneId}`} placeholder={`Pane ${paneId}`} />;
}
