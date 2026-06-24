import {
  createDefaultCommandRegistry,
  createDefaultPaneKeymap,
  createWorkspace,
  collectPaneIds,
  defaultPaneShortcutActions,
  type Workspace,
  type WorkspaceState,
} from "@focusgrid/core";
import { PaneProvider, PaneRoot, useWorkspaceState } from "@focusgrid/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
} from "react";

type PaneComponentProps = {
  paneId: string;
  active: boolean;
  workspace: Workspace;
};

const shortcutStorageKey = "focusgrid.playground.shortcuts";

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

function createDefaultShortcuts(): Record<string, string> {
  return Object.fromEntries(
    defaultPaneShortcutActions.map((action) => [
      action.id,
      action.defaultSequence,
    ]),
  );
}

function migrateSavedShortcutSyntax(sequence: string): string {
  return sequence
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((stroke) => {
      if (!stroke.includes("+")) {
        return stroke;
      }

      const parts = stroke.split("+");
      const key = parts.at(-1);
      const modifiers = parts.slice(0, -1);

      if (!key || modifiers.length === 0 || !modifiers.every(isKeyModifier)) {
        return stroke;
      }

      return [...modifiers, key].join("-");
    })
    .join(" ");
}

function isKeyModifier(input: string): boolean {
  const modifier = input.toLowerCase();
  return (
    modifier === "ctrl" ||
    modifier === "control" ||
    modifier === "mod" ||
    modifier === "meta" ||
    modifier === "cmd" ||
    modifier === "alt" ||
    modifier === "option" ||
    modifier === "shift"
  );
}

function loadSavedShortcuts(): Record<string, string> {
  const defaults = createDefaultShortcuts();

  try {
    const saved = window.localStorage.getItem(shortcutStorageKey);

    if (!saved) {
      return defaults;
    }

    const parsed: unknown = JSON.parse(saved);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaults;
    }

    return defaultPaneShortcutActions.reduce<Record<string, string>>(
      (shortcuts, action) => {
        const value = (parsed as Record<string, unknown>)[action.id];
        shortcuts[action.id] =
          typeof value === "string"
            ? migrateSavedShortcutSyntax(value)
            : action.defaultSequence;
        return shortcuts;
      },
      {},
    );
  } catch {
    return defaults;
  }
}

function saveShortcuts(shortcuts: Record<string, string>): void {
  try {
    window.localStorage.setItem(shortcutStorageKey, JSON.stringify(shortcuts));
  } catch {
    // The playground should keep working when storage is unavailable.
  }
}

const workspace = createWorkspace(createInitialState(), {
  commands: createDefaultCommandRegistry(),
});

const paneComponents: Record<string, ComponentType<PaneComponentProps>> = {
  alpha: TextPane,
  beta: TextPane,
};

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shortcuts, setShortcuts] = useState(loadSavedShortcuts);
  const keymap = useMemo(() => createDefaultPaneKeymap(shortcuts), [shortcuts]);

  useEffect(() => {
    saveShortcuts(shortcuts);
  }, [shortcuts]);

  return (
    <PaneProvider workspace={workspace}>
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
          <PaneRoot
            className="PlaygroundPaneRoot"
            keymap={keymap}
            renderPane={(paneId) => {
              return <PaneSlot paneId={paneId} workspace={workspace} />;
            }}
          />
        </main>
      </div>
    </PaneProvider>
  );
}

function Sidebar({
  shortcuts,
  onShortcutChange,
}: {
  shortcuts: Record<string, string>;
  onShortcutChange: (id: string, sequence: string) => void;
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

            workspace.dispatch({
              type: "pane.swap",
              firstPaneId: activePaneId,
              secondPaneId: swapTargetId,
            });
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

function PaneSlot({
  paneId,
  workspace,
}: {
  paneId: string;
  workspace: Workspace;
}) {
  const state = useWorkspaceState();
  const Component = paneComponents[paneId] ?? TextPane;

  return (
    <Component
      paneId={paneId}
      active={state.activePaneId === paneId}
      workspace={workspace}
    />
  );
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
          workspace.dispatch({
            type: "pane.focus",
            paneId,
          });
        }}
      />
    </section>
  );
}
