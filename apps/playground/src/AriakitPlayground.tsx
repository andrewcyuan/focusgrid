import { isEditableTarget } from "@andrewcyuan/focusgrid/dom";
import {
  Composite,
  CompositeItem,
  useCompositeStore,
} from "@ariakit/react";
import {
  FocusGrid,
  useFocusGridController,
  type Pane,
  createCompositeNavigationKeymap,
  useShortcuts,
  ShortcutScope,
  type CompositeNavigationDirection,
} from "@andrewcyuan/focusgrid/react";
import {
  type FocusGridControllerState,
} from "@andrewcyuan/focusgrid/core";
import { useRef, useState } from "react";
import { DemoHeader } from "./DemoHeader";
import {
  createDemoPaneKeymap,
  paneNavigationShortcuts,
} from "./pane-navigation";


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
  const controller = useFocusGridController(() => ({ ...createAriakitState(), minWidth: 320, minHeight: 320 }));
  const paneKeymap = createDemoPaneKeymap(controller);
  const applicationRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={applicationRef} className="AriakitPage">
      <DemoHeader
        title="Ariakit composite"
        description="Application-managed pane focus meets Ariakit collection navigation."
        shortcutSummary={shortcutSummary}
      >
        <p className="DemoHeaderDetail">
          Static header clicks restore the active row; header links keep focus.
        </p>
      </DemoHeader>
      <FocusGrid
        controller={controller}
        keymap={paneKeymap}
        focusManagement={{
          mode: "application",
          scopeRef: applicationRef,
        }}
        className="AriakitFocusGrid"
        renderPane={(context) => <AriakitPane {...context} />}
      />
    </div>
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
