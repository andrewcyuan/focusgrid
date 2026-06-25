import {
  createDefaultPaneKeymap,
  collectPaneIds,
  defaultPaneShortcutActions,
  paneSplitSides,
  type PaneShortcutId,
  type PaneShortcutValues,
  type Workspace,
  type WorkspaceState,
} from "@focusgrid/core";
import {
  type PaneComponent,
  type PaneComponentProps,
  FocusGridProvider,
  FocusGrid,
  useFocusGridWorkspace,
  useWorkspaceState,
  type PaneRenderContext,
} from "@focusgrid/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { loadSavedShortcuts, saveShortcuts } from "./shortcuts";

function createInitialState(): WorkspaceState {
  return {
    root: {
      kind: "split",
      id: "root-split",
      direction: "horizontal",
      sizes: [0.55, 0.45],
      children: [
        {
          kind: "pane",
          id: "pane-node-alpha",
          paneId: "alpha",
          minWidth: 180,
          minHeight: 120,
        },
        {
          kind: "pane",
          id: "pane-node-beta",
          paneId: "beta",
          minWidth: 180,
          minHeight: 120,
        },
      ],
    },
    activePaneId: "alpha",
    container: {
      width: 0,
      height: 0,
    },
  };
}

const paneComponents: Record<string, PaneComponent> = {
  alpha: TextPane,
  beta: TextPane,
};

export function App() {
  const workspace = useFocusGridWorkspace(createInitialState);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shortcuts, setShortcuts] = useState(loadSavedShortcuts());
  const keymap = useMemo(
    () => createDefaultPaneKeymap({ overrides: shortcuts }),
    [shortcuts],
  );

  useEffect(() => {
    saveShortcuts(shortcuts);
  }, [shortcuts]);

  return (
    <FocusGridProvider workspace={workspace} keymap={keymap}>
      <div className="AppShell" data-sidebar-open={sidebarOpen}>
        {sidebarOpen ? (
          <Sidebar
            shortcuts={shortcuts}
            onShortcutChange={(id, sequence) => {
              setShortcuts((current) => ({
                ...current,
                [id]: sequence,
              }));
            }}
          />
        ) : null}

        <main className="WorkspaceShell">
          <Toolbar
            sidebarOpen={sidebarOpen}
            workspace={workspace}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
          />
          <FocusGrid
            className="PlaygroundFocusGrid"
            renderPane={(ctx) => {
              return <PaneSlot ctx={ctx} />;
            }}
          />
        </main>
      </div>
    </FocusGridProvider>
  );
}

function Sidebar({
  shortcuts,
  onShortcutChange,
}: {
  shortcuts: PaneShortcutValues;
  onShortcutChange: (id: PaneShortcutId, sequence: string) => void;
}) {
  return (
    <aside className="Sidebar">
      <div className="SidebarHeader">
        <h1>Focusgrid</h1>
        <span>React playground</span>
      </div>

      <div className="ShortcutList">
        {defaultPaneShortcutActions.map((action) => (
          <label className="ShortcutBinder" key={action.id}>
            <span>{action.label}</span>
            <input
              value={shortcuts[action.id] ?? ""}
              spellCheck={false}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onShortcutChange(action.id, event.target.value);
              }}
            />
          </label>
        ))}
      </div>
    </aside>
  );
}

function Toolbar({
  sidebarOpen,
  workspace,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  workspace: Workspace;
  onToggleSidebar: () => void;
}) {
  const state = useWorkspaceState();
  const paneIds = useMemo(() => collectPaneIds(state.root), [state.root]);
  const swapTargets = useMemo(
    () => paneIds.filter((paneId) => paneId !== state.activePaneId),
    [paneIds, state.activePaneId],
  );
  const [swapTargetId, setSwapTargetId] = useState(swapTargets[0] ?? "");

  useEffect(() => {
    if (swapTargetId && swapTargets.includes(swapTargetId)) {
      return;
    }

    setSwapTargetId(swapTargets[0] ?? "");
  }, [swapTargetId, swapTargets]);

  return (
    <header className="Toolbar">
      <button type="button" onClick={onToggleSidebar}>
        {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      </button>
      <div className="ToolbarActions">
        <div className="ToolbarButtonGroup" aria-label="Wrap root in split">
          {paneSplitSides.map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => {
                workspace.api.wrapRootInSplit({
                  side,
                  minWidth:
                    side === "left" || side === "right" ? 180 : undefined,
                  minHeight: side === "up" || side === "down" ? 120 : undefined,
                  preserveActivePane: true,
                });
              }}
            >
              Root {side}
            </button>
          ))}
        </div>
        <label>
          <span>Swap active with</span>
          <select
            value={swapTargetId}
            disabled={swapTargets.length === 0}
            onChange={(event) => setSwapTargetId(event.target.value)}
          >
            {swapTargets.map((paneId) => (
              <option key={paneId} value={paneId}>
                {paneId}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!state.activePaneId || !swapTargetId}
          onClick={() => {
            const activePaneId = state.activePaneId;

            if (!activePaneId || !swapTargetId) {
              return;
            }

            workspace.api.swap(activePaneId, swapTargetId);
          }}
        >
          Swap
        </button>
      </div>
      <div className="ToolbarMeta">
        <span>Active: {state.activePaneId ?? "none"}</span>
        <span>
          Root: {state.container.width} x {state.container.height}
        </span>
      </div>
    </header>
  );
}

function PaneSlot({ ctx }: { ctx: PaneRenderContext }) {
  const Component = paneComponents[ctx.paneId] ?? TextPane;

  return <Component {...ctx} />;
}

function TextPane({ paneId, active, workspace }: PaneComponentProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!active || document.activeElement === inputRef.current) {
      return;
    }

    inputRef.current?.focus();
  }, [active]);

  return (
    <section className="TextPane" data-active={active}>
      <div className="TextPaneHeader">
        <strong>{paneId}</strong>
        <span>{active ? "focused" : "idle"}</span>
      </div>
      <textarea
        ref={inputRef}
        defaultValue={`This is pane "${paneId}". Focus this textbox to focus its pane.`}
        onFocus={() => {
          workspace.api.focus(paneId);
        }}
      />
    </section>
  );
}
