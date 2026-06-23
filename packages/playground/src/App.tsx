import {
  CommandRegistry,
  collectPaneIds,
  createDefaultCommandRegistry,
  createWorkspace,
  parseKeySequence,
  type KeyBinding,
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

type ShortcutAction = {
  id: string;
  label: string;
  command: string;
  defaultSequence: string;
};

type PaneComponentProps = {
  paneId: string;
  active: boolean;
  workspace: Workspace;
};

const shortcutStorageKey = "focusgrid.playground.shortcuts";

const shortcutActions: ShortcutAction[] = [
  {
    id: "split-right",
    label: "Split right",
    command: "pane.splitRight",
    defaultSequence: "Ctrl+B %",
  },
  {
    id: "split-down",
    label: "Split down",
    command: "pane.splitDown",
    defaultSequence: "Ctrl+B \"",
  },
  {
    id: "close",
    label: "Close active",
    command: "pane.close",
    defaultSequence: "Ctrl+B X",
  },
  {
    id: "focus-next",
    label: "Focus next",
    command: "pane.focusNext",
    defaultSequence: "Ctrl+B N",
  },
  {
    id: "focus-prev",
    label: "Focus previous",
    command: "pane.focusPrevious",
    defaultSequence: "Ctrl+B P",
  },
];

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

function createPlaygroundCommands(): CommandRegistry {
  const commands = createDefaultCommandRegistry();

  commands.register("pane.focusNext", ({ workspace, state }) => {
    focusRelativePane(workspace, state, 1);
  });

  commands.register("pane.focusPrevious", ({ workspace, state }) => {
    focusRelativePane(workspace, state, -1);
  });

  return commands;
}

function focusRelativePane(
  workspace: Workspace,
  state: WorkspaceState,
  delta: 1 | -1,
): void {
  const paneIds = collectPaneIds(state.root);

  if (paneIds.length === 0) {
    return;
  }

  const activeIndex = Math.max(0, paneIds.indexOf(state.activePaneId ?? ""));
  const nextIndex = (activeIndex + delta + paneIds.length) % paneIds.length;

  workspace.dispatch({
    type: "pane.focus",
    paneId: paneIds[nextIndex]!,
  });
}

function createKeymap(shortcuts: Record<string, string>): KeyBinding[] {
  return shortcutActions.flatMap((action) => {
    const sequence = shortcuts[action.id]?.trim();

    if (!sequence) {
      return [];
    }

    try {
      return [
        {
          sequence: parseKeySequence(sequence),
          command: action.command,
          preventDefault: true,
        },
      ];
    } catch {
      return [];
    }
  });
}

function createDefaultShortcuts(): Record<string, string> {
  return Object.fromEntries(
    shortcutActions.map((action) => [action.id, action.defaultSequence]),
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

    return shortcutActions.reduce<Record<string, string>>((shortcuts, action) => {
      const value = (parsed as Record<string, unknown>)[action.id];
      shortcuts[action.id] =
        typeof value === "string" ? value : action.defaultSequence;
      return shortcuts;
    }, {});
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
  commands: createPlaygroundCommands(),
});

const paneComponents: Record<string, ComponentType<PaneComponentProps>> = {
  alpha: TextPane,
  beta: TextPane,
};

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shortcuts, setShortcuts] = useState(loadSavedShortcuts);
  const keymap = useMemo(() => createKeymap(shortcuts), [shortcuts]);

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
        {shortcutActions.map((action) => (
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
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const state = useWorkspaceState();

  return (
    <header className="Toolbar">
      <button type="button" onClick={onToggleSidebar}>
        {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      </button>
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
