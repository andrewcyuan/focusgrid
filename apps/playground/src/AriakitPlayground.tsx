import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { useShortcuts, ShortcutScope } from "@andrewcyuan/shortcut-engine/react";
import { isEditableTarget } from "@andrewcyuan/focusgrid/dom";
import { Composite, CompositeItem, useCompositeStore } from "@ariakit/react";
import { FocusgridController, FocusGrid, useFocusGridController, type Pane, createCompositeNavigationKeymap, type CompositeNavigationDirection } from "@andrewcyuan/focusgrid/react";
import { type FocusGridControllerState } from "@andrewcyuan/focusgrid/core";
import { useState } from "react";
import { DemoHeader } from "./DemoHeader";
import { createDemoPaneKeymap, paneNavigationShortcuts } from "./pane-navigation";


const rows = [
  { id: "alpha", label: "Alpha" },
  { id: "beta", label: "Beta" },
  { id: "gamma", label: "Gamma" },
  { id: "delta", label: "Delta" },
] as const;

const shortcutSummary = [
  "Arrows",
  "H/J/K/L",
  "G G",
  "Shift-G",
  "Enter",
  "Space",
  ...paneNavigationShortcuts,
];

function createAriakitState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "ariakit-root-split",
      orientation: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        {
          kind: "pane",
          id: "pane-node-ariakit-alpha",
          paneId: "ariakit-alpha",
        },
        {
          kind: "pane",
          id: "pane-node-ariakit-beta",
          paneId: "ariakit-beta",
        },
      ],
    },
    activePaneId: "ariakit-alpha",
    container: {
      width: 0,
      height: 0,
    },
  };
}

export function AriakitPlayground() {
  const [domController] = useState(() => new FocusGridDomController());
  const controller = useFocusGridController(() => ({ ...createAriakitState(), minWidth: 320, minHeight: 320 }), domController);
  const paneKeymap = createDemoPaneKeymap(controller);

  return (
    <FocusgridController.Provider value={{ controller, domController }}>
      <div className="AriakitPage">
        <DemoHeader
          title="Ariakit composite"
          description="Pane shortcuts and Ariakit collection navigation."
          shortcutSummary={shortcutSummary}
        >
          <p className="DemoHeaderDetail">
            Pane navigation focuses the destination pane shell. Click a row to enter its collection.
          </p>
        </DemoHeader>
        <FocusGrid
          keymap={paneKeymap}
          className="AriakitFocusGrid"
          renderPane={(context) => <AriakitPane {...context} />}
        />
      </div>
    </FocusgridController.Provider>
  );
}

function AriakitPane(props: Pane) {
  return <ShortcutScope style={{ display: "contents" }}><AriakitPaneContent {...props} /></ShortcutScope>;
}

function AriakitPaneContent({ active, paneId }: Pane) {
  const composite = useCompositeStore({ orientation: "both" });
  const [action, setAction] = useState<{
    key: "Enter" | "Space";
    row: string;
    defaultPrevented: boolean;
  } | null>(null);

  const move = (direction: CompositeNavigationDirection) => {
    const target = {
      left: () => composite.previous(), right: () => composite.next(),
      up: () => composite.up(), down: () => composite.down(),
      start: () => composite.first(), end: () => composite.last(),
    }[direction]();
    composite.move(target);
  };
  const activate = (key: "Enter" | "Space", event: KeyboardEvent) => {
    const target = event.target;
    const activeId = target instanceof HTMLElement && target.id ? target.id : composite.getState().activeId;
    const row = rows.find(candidate => createRowId(paneId, candidate.id) === activeId)?.label;
    if (row) setAction({ key, row, defaultPrevented: event.defaultPrevented });
  };
  useShortcuts([
    ...createCompositeNavigationKeymap(move),
    ...([ ["H", "left"], ["J", "down"], ["K", "up"], ["L", "right"], ["G G", "start"], ["Shift-G", "end"] ] as const).map(([key, direction]) => ({
      sequence: key, action: () => move(direction),
      when: (event: KeyboardEvent) => !isEditableTarget(event.target),
    })),
    ...(["Enter", "Space"] as const).map(key => ({
      sequence: key, action: (event: KeyboardEvent) => activate(key, event),
      when: (event: KeyboardEvent) => !isEditableTarget(event.target),
    })),
  ]);

  return (
    <section className="AriakitPane" data-active={active}>
      <div className="AriakitPaneIntro">
        <div>
          <strong>Ariakit-managed rows</strong>
          <span>inside Focusgrid pane “{paneId}”</span>
        </div>
        <div className="AriakitShortcutList" aria-label="Demo shortcuts">
          {shortcutSummary.map((shortcut) => (
            <kbd key={shortcut}>{shortcut}</kbd>
          ))}
        </div>
      </div>

      <Composite
        data-focusgrid-composite=""
        store={composite}
        className="AriakitComposite"
        aria-label={`Ariakit rows in ${paneId}`}
      >
        <div className="AriakitRows">
          {rows.map((row) => (
            <CompositeItem
              store={composite}
              className="AriakitRow"
              data-row-id={row.id}
              id={createRowId(paneId, row.id)}
              key={row.id}
            >
              <span>{row.label}</span>
              <small>Composite item</small>
            </CompositeItem>
          ))}
        </div>

        <label className="AriakitEditable">
          <span>Editable input (shortcuts ignore typing)</span>
          <input
            aria-label="Editable input"
            placeholder="Type J, K, G, or spaces here"
          />
        </label>
      </Composite>

      <output
        className="AriakitActionStatus"
        data-default-prevented={action?.defaultPrevented ?? false}
        aria-live="polite"
      >
        {action ? `${action.key} on ${action.row}` : "No row action yet"}
      </output>
    </section>
  );
}

function createRowId(paneId: string, rowId: string): string {
  return `${paneId}-row-${rowId}`;
}
