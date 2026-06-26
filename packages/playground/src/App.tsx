import {
  createDefaultPaneKeymap,
  collectPaneIds,
  defaultPaneShortcutActions,
  paneSplitSides,
  type PaneShortcutId,
  type PaneShortcutValues,
  type FocusGridController,
  type FocusGridControllerState,
} from "@focusgrid/core";
import {
  type PaneComponent,
  type PaneComponentProps,
  FocusGrid,
  useControllerState,
  useFocusGridController,
  type PaneRenderContext,
} from "@focusgrid/react";
import {
  createDefaultKCLKeymap,
  createDefaultKCLShortcuts,
  defaultKCLShortcutActions,
  KeyboardControlledList,
  useKCLController,
  type KCLShortcutId,
  type KCLShortcutValues,
} from "@focusgrid/kcl-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { loadSavedShortcuts, saveShortcuts } from "./shortcuts";
import {
  createInitialTodos,
  toggleTodo,
  updateTodoLabel,
  type TodoItem,
} from "./kcl-todos";

function createInitialState(): FocusGridControllerState {
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
  return window.location.pathname === "/kcl" ? (
    <KCLPlayground />
  ) : (
    <FocusGridPlayground />
  );
}

function FocusGridPlayground() {
  const controller = useFocusGridController(createInitialState);
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

      <main className="ControllerShell">
        <Toolbar
          sidebarOpen={sidebarOpen}
          controller={controller}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <FocusGrid
          controller={controller}
          keymap={keymap}
          className="PlaygroundFocusGrid"
          renderPane={(ctx) => {
            return <PaneSlot ctx={ctx} />;
          }}
        />
      </main>
    </div>
  );
}

function KCLPlayground() {
  const controller = useFocusGridController(createInitialState);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [kclShortcuts, setKclShortcuts] = useState(createDefaultKCLShortcuts());
  const [focusGridShortcuts, setFocusGridShortcuts] = useState(
    loadSavedShortcuts(),
  );
  const focusGridKeymap = useMemo(
    () => createDefaultPaneKeymap({ overrides: focusGridShortcuts }),
    [focusGridShortcuts],
  );

  useEffect(() => {
    saveShortcuts(focusGridShortcuts);
  }, [focusGridShortcuts]);

  return (
    <div className="AppShell" data-sidebar-open={sidebarOpen}>
      {sidebarOpen ? (
        <KCLSidebar
          kclShortcuts={kclShortcuts}
          focusGridShortcuts={focusGridShortcuts}
          onKCLShortcutChange={(id, sequence) => {
            setKclShortcuts((current) => ({
              ...current,
              [id]: sequence,
            }));
          }}
          onFocusGridShortcutChange={(id, sequence) => {
            setFocusGridShortcuts((current) => ({
              ...current,
              [id]: sequence,
            }));
          }}
        />
      ) : null}

      <main className="ControllerShell">
        <KCLToolbar
          sidebarOpen={sidebarOpen}
          controller={controller}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <FocusGrid
          controller={controller}
          keymap={focusGridKeymap}
          className="PlaygroundFocusGrid"
          renderPane={(ctx) => {
            return <KCLTodoPane {...ctx} shortcuts={kclShortcuts} />;
          }}
        />
      </main>
    </div>
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

function KCLSidebar({
  kclShortcuts,
  focusGridShortcuts,
  onKCLShortcutChange,
  onFocusGridShortcutChange,
}: {
  kclShortcuts: KCLShortcutValues;
  focusGridShortcuts: PaneShortcutValues;
  onKCLShortcutChange: (id: KCLShortcutId, sequence: string) => void;
  onFocusGridShortcutChange: (id: PaneShortcutId, sequence: string) => void;
}) {
  return (
    <aside className="Sidebar">
      <div className="SidebarHeader">
        <h1>Focusgrid KCL</h1>
        <span>Pane and list shortcuts</span>
      </div>

      <div className="SidebarSection">
        <h2>KCL rows</h2>
        <div className="ShortcutList">
          {defaultKCLShortcutActions.map((action) => (
            <label className="ShortcutBinder" key={action.id}>
              <span>{action.label}</span>
              <input
                value={kclShortcuts[action.id] ?? ""}
                spellCheck={false}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  onKCLShortcutChange(action.id, event.target.value);
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="SidebarSection">
        <h2>FocusGrid panes</h2>
        <div className="ShortcutList">
          {defaultPaneShortcutActions.map((action) => (
            <label className="ShortcutBinder" key={action.id}>
              <span>{action.label}</span>
              <input
                value={focusGridShortcuts[action.id] ?? ""}
                spellCheck={false}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  onFocusGridShortcutChange(action.id, event.target.value);
                }}
              />
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Toolbar({
  sidebarOpen,
  controller,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  controller: FocusGridController;
  onToggleSidebar: () => void;
}) {
  const state = useControllerState(controller);
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
                controller.api.wrapRootInSplit({
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

            controller.api.swap(activePaneId, swapTargetId);
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

function KCLToolbar({
  sidebarOpen,
  controller,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  controller: FocusGridController;
  onToggleSidebar: () => void;
}) {
  const state = useControllerState(controller);

  return (
    <header className="Toolbar">
      <button type="button" onClick={onToggleSidebar}>
        {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      </button>
      <div className="ToolbarActions">
        <a className="ToolbarLink" href="/">
          FocusGrid
        </a>
        <span className="ToolbarMode">KCL todo lists</span>
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

function TextPane({ paneId, active, controller }: PaneComponentProps) {
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
          controller.api.focus(paneId);
        }}
      />
    </section>
  );
}

function KCLTodoPane({
  paneId,
  active,
  controller,
  shortcuts,
}: PaneComponentProps & { shortcuts: KCLShortcutValues }) {
  const [todos, setTodos] = useState(() => createInitialTodos(paneId));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const kclController = useKCLController({
    itemCount: todos.length,
    orientation: "vertical",
  });
  const paneRef = useRef<HTMLElement | null>(null);
  const keymap = useMemo(
    () =>
      createDefaultKCLKeymap<TodoItem>({
        overrides: shortcuts,
        onActivate: (ctx) => {
          setTodos((current) => toggleTodo(current, ctx.index));
        },
        onEdit: (ctx) => {
          setEditingIndex(ctx.index);
        },
      }),
    [shortcuts],
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    controller.api.focus(paneId);
    const list = paneRef.current?.querySelector<HTMLElement>(
      ".KCLKeyboardControlledList",
    );
    list?.focus();
  }, [active, controller, paneId]);

  useEffect(() => {
    const input = paneRef.current?.querySelector<HTMLInputElement>(
      '[data-kcl-edit-input="true"]',
    );

    if (!input) {
      return;
    }

    input.focus();
    input.select();
  }, [editingIndex]);

  const focusListRoot = () => {
    paneRef.current
      ?.querySelector<HTMLElement>(".KCLKeyboardControlledList")
      ?.focus();
  };

  const stopEditing = () => {
    setEditingIndex(null);
    requestAnimationFrame(focusListRoot);
  };

  const onEditInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" && event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    stopEditing();
  };

  return (
    <section
      ref={paneRef}
      className="TextPane KCLPane"
      data-active={active}
      data-kcl-pane-id={paneId}
    >
      <div className="TextPaneHeader">
        <strong>{paneId}</strong>
        <span>{active ? "focused" : "idle"}</span>
      </div>
      <KeyboardControlledList
        controller={kclController}
        keymap={keymap}
        direction="vertical"
        dataList={todos}
        renderCell={(ctx) => (
          <div className="KCLTodoRow" data-checked={ctx.data.checked}>
            <input
              type="checkbox"
              tabIndex={-1}
              readOnly
              checked={ctx.data.checked}
            />
            {editingIndex === ctx.index ? (
              <input
                data-kcl-edit-input="true"
                value={ctx.data.label}
                spellCheck={false}
                onChange={(event) => {
                  setTodos((current) =>
                    updateTodoLabel(current, ctx.index, event.target.value),
                  );
                }}
                onKeyDown={onEditInputKeyDown}
              />
            ) : (
              <span>{ctx.data.label}</span>
            )}
          </div>
        )}
      />
    </section>
  );
}
