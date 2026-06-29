import {
  createDefaultPaneKeymap,
  defaultPaneShortcutActions,
  paneSplitSides,
  type LayoutNode,
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
  KCCollection,
  KCItem,
  KCList,
  createDefaultKCCollectionKeymap,
  createDefaultKCLShortcuts,
  defaultKCLShortcutActions,
  useKCLController,
  type KCLActionBinding,
  type KCActionContext,
  type KCLShortcutId,
  type KCLShortcutValues,
} from "@focusgrid/kcc-react";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { loadSavedShortcuts, saveShortcuts } from "./shortcuts";
import {
  createInitialTodos,
  toggleTodoById,
  updateTodoLabelById,
  type TodoItem,
} from "./kcc-todos";

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
  return window.location.pathname === "/kcc" ? (
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
        <h1>Focusgrid KCC</h1>
        <span>Pane and list shortcuts</span>
      </div>

      <div className="SidebarSection">
        <h2>KCC rows</h2>
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

function collectPaneIds(root: LayoutNode): string[] {
  if (root.kind === "pane") {
    return [root.paneId];
  }

  return root.children.flatMap((child) => collectPaneIds(child));
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
        <span className="ToolbarMode">KCC todo lists</span>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);
  const nextAddedTodoRef = useRef(1);
  const kclController = useKCLController({
    orientation: "vertical",
  });
  const paneRef = useRef<HTMLElement | null>(null);
  const splitTodoIndex = Math.ceil(todos.length / 2);
  const topTodos = todos.slice(0, splitTodoIndex);
  const bottomTodos = todos.slice(splitTodoIndex);
  const addTodo = useCallback(() => {
    setTodos((current) => {
      const nextNumber = current.length + 1;
      const nextAddedTodo = nextAddedTodoRef.current;
      nextAddedTodoRef.current += 1;

      return [
        ...current,
        {
          id: `${paneId}-added-${nextAddedTodo}`,
          label: `New ${paneId} item ${nextNumber}`,
          checked: false,
        },
      ];
    });
  }, [paneId]);
  const nativeKeymap = useMemo(
    () =>
      createDefaultKCCollectionKeymap({
        overrides: shortcuts,
      }),
    [shortcuts],
  );
  const todoActions = useMemo<readonly KCLActionBinding<TodoItem>[]>(
    () => [
      {
        sequence: "A",
        action: () => {
          addTodo();
        },
      },
      {
        sequence: shortcuts.activate,
        command: "activate",
        action: (ctx: KCActionContext<TodoItem>) => {
          setTodos((current) => toggleTodoById(current, ctx.id));
        },
      },
      {
        sequence: shortcuts.edit,
        command: "edit",
        action: (ctx: KCActionContext<TodoItem>) => {
          setEditingId(ctx.id);
        },
      },
    ],
    [addTodo, shortcuts],
  );
  const counterActions = useMemo<readonly KCLActionBinding<number>[]>(
    () => [
      {
        sequence: "A",
        action: () => {
          addTodo();
        },
      },
      {
        sequence: shortcuts.activate,
        command: "activate",
        action: () => {
          setCounter((value) => value + 1);
        },
      },
    ],
    [addTodo, shortcuts.activate],
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
  }, [editingId]);

  const focusListRoot = () => {
    paneRef.current
      ?.querySelector<HTMLElement>(".KCLKeyboardControlledList")
      ?.focus();
  };

  const stopEditing = () => {
    setEditingId(null);
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
      <KCCollection
        controller={kclController}
        keymap={nativeKeymap}
        direction="vertical"
        className="KCLKeyboardControlledList"
      >
        <KCList
          dataList={topTodos}
          getItemId={(todo) => todo.id}
          customActionKeybinds={todoActions}
          renderCell={(ctx) => (
            <div className="KCLTodoRow" data-checked={ctx.data.checked}>
              <input
                type="checkbox"
                tabIndex={-1}
                readOnly
                checked={ctx.data.checked}
              />
              <input
                type="radio"
                tabIndex={-1}
                readOnly
                checked={false}
                name={`${paneId}-todo-row-radio`}
                aria-label={`Select ${ctx.data.label}`}
              />
              <input
                type="button"
                tabIndex={-1}
                value="Row"
                aria-label={`Row action ${ctx.data.label}`}
              />
              {editingId === ctx.id ? (
                <input
                  data-kcl-edit-input="true"
                  value={ctx.data.label}
                  spellCheck={false}
                  onChange={(event) => {
                    setTodos((current) =>
                      updateTodoLabelById(current, ctx.id, event.target.value),
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
        <div className="KCLStaticItem">
          <strong>Static collection item</strong>
          <span>Not part of the todo data list</span>
        </div>
        <KCList
          dataList={bottomTodos}
          getItemId={(todo) => todo.id}
          customActionKeybinds={todoActions}
          renderCell={(ctx) => (
            <div className="KCLTodoRow" data-checked={ctx.data.checked}>
              <input
                type="checkbox"
                tabIndex={-1}
                readOnly
                checked={ctx.data.checked}
              />
              <input
                type="radio"
                tabIndex={-1}
                readOnly
                checked={false}
                name={`${paneId}-todo-row-radio`}
                aria-label={`Select ${ctx.data.label}`}
              />
              <input
                type="button"
                tabIndex={-1}
                value="Row"
                aria-label={`Row action ${ctx.data.label}`}
              />
              {editingId === ctx.id ? (
                <input
                  data-kcl-edit-input="true"
                  value={ctx.data.label}
                  spellCheck={false}
                  onChange={(event) => {
                    setTodos((current) =>
                      updateTodoLabelById(current, ctx.id, event.target.value),
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
        <KCItem
          id={`${paneId}-counter`}
          data={counter}
          className="KCLCounterItem"
          customActionKeybinds={counterActions}
        >
          {(ctx) => (
            <button className="KCLCounterButton" type="button" tabIndex={-1}>
              Counter {ctx.data}
            </button>
          )}
        </KCItem>
      </KCCollection>
    </section>
  );
}
