import {
  Composite,
  CompositeItem,
  useCompositeStore,
} from "@ariakit/react";
import {
  createCompositeNavigationKeymap,
  useCompositeShortcutRouter,
  type CompositeNavigationShortcutArgs,
  type CompositeNavigationShortcutId,
} from "@focusgrid/ariakit-adapter/react";
import {
  createDefaultPaneKeymap,
  type FocusGridControllerState,
} from "@focusgrid/focusgrid/core";
import {
  FocusGrid,
  useFocusGridController,
  type PaneComponentProps,
} from "@focusgrid/focusgrid/react";
import {
  parseKeySequence,
  type ShortcutBinding,
} from "@focusgrid/shortcut-engine";
import { useCallback, useRef, useState } from "react";

type AriakitDemoAction = CompositeNavigationShortcutId | "Enter" | "Space";
type AriakitDemoArgs = CompositeNavigationShortcutArgs | undefined;

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
  "Ctrl-B ←/→ panes",
];
const paneKeymap = createDefaultPaneKeymap().keymap;

const ariakitKeymap: ShortcutBinding<
  undefined,
  AriakitDemoAction,
  AriakitDemoArgs
>[] = [
  ...createCompositeNavigationKeymap({
    overrides: {
      "move-left": "H",
      "move-right": "L",
      "move-up": "K",
      "move-down": "J",
      "move-start": "G G",
      "move-end": "Shift-G",
    },
  }),
  {
    sequence: parseKeySequence("Enter"),
    action: "Enter",
  },
  {
    sequence: parseKeySequence("Space"),
    action: "Space",
  },
];

function createAriakitState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "ariakit-root-split",
      direction: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        {
          kind: "pane",
          id: "pane-node-ariakit-alpha",
          paneId: "ariakit-alpha",
          minWidth: 320,
          minHeight: 320,
        },
        {
          kind: "pane",
          id: "pane-node-ariakit-beta",
          paneId: "ariakit-beta",
          minWidth: 320,
          minHeight: 320,
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
  const controller = useFocusGridController(createAriakitState);
  const applicationRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={applicationRef} className="AriakitPage">
      <header className="AriakitPageHeader">
        <div>
          <h1>Ariakit Composite</h1>
          <p>Active pane selections are blue; inactive selections stay gray</p>
          <p>
            Focusgrid restores application focus while Ariakit moves focus
            inside each Composite. Clicking static header space returns to the
            active pane; interactive header controls keep their own focus.
          </p>
        </div>
        <a className="ToolbarLink" href="/">
          Focusgrid playground
        </a>
      </header>
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

function AriakitPane({ active, paneId }: PaneComponentProps) {
  const composite = useCompositeStore({ orientation: "both" });
  const [action, setAction] = useState<{
    key: "Enter" | "Space";
    row: string;
    defaultPrevented: boolean;
  } | null>(null);

  const onMatch = useCallback(
    ({
      action: matchedAction,
      event,
    }: {
      action: AriakitDemoAction;
      event: KeyboardEvent;
    }) => {
      switch (matchedAction) {
        case "move-left":
          composite.move(composite.previous());
          return;
        case "move-right":
          composite.move(composite.next());
          return;
        case "move-up":
          composite.move(composite.up());
          return;
        case "move-down":
          composite.move(composite.down());
          return;
        case "move-start":
          composite.move(composite.first());
          return;
        case "move-end":
          composite.move(composite.last());
          return;
        case "Enter":
        case "Space": {
          const eventTarget = event.target;
          const activeId =
            eventTarget instanceof HTMLElement && eventTarget.id
              ? eventTarget.id
              : composite.getState().activeId;
          const row = rows.find(
            (candidate) => createRowId(paneId, candidate.id) === activeId,
          )?.label;

          if (row) {
            setAction({
              key: matchedAction,
              row,
              defaultPrevented: event.defaultPrevented,
            });
          }
        }
      }
    },
    [composite, paneId],
  );

  const shortcutRouter = useCompositeShortcutRouter<
    undefined,
    AriakitDemoAction,
    AriakitDemoArgs,
    HTMLDivElement
  >({
    keymap: ariakitKeymap,
    onMatch,
  });

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
        {...shortcutRouter.compositeProps}
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
          <span>Editable input (adapter ignores typing)</span>
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
