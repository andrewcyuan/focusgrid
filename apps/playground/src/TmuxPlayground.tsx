import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { defaultPaneShortcutActions, type PaneShortcutId, type PaneShortcutValues } from "@andrewcyuan/focusgrid/react";
import { normalizeShortcut } from "@andrewcyuan/shortcut-engine";
import { cardinalDirections, findPaneNode, collectPaneIds, PaneCommandCapability, type FocusGridController, type FocusGridControllerState } from "@andrewcyuan/focusgrid/core";
import { FocusGrid, useControllerState, useFocusGridController, type Pane } from "@andrewcyuan/focusgrid/react";
import { type ComponentType, useEffect, useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { loadSavedShortcuts, saveShortcuts } from "./shortcuts";
import { demoHubPath } from "./demo-routes";

function createInitialState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root-split",
      orientation: "horizontal",
      sizes: [0.55, 0.45],
      children: [
        {
          kind: "pane",
          id: "pane-node-alpha",
          paneId: "alpha",
        },
        {
          kind: "pane",
          id: "pane-node-beta",
          paneId: "beta",
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

const paneComponents: Record<string, ComponentType<Pane>> = {
  alpha: TextPane,
  beta: TextPane,
};

export function TmuxPlayground() {
  const [domController] = useState(() => new FocusGridDomController());
  const controller = useFocusGridController(() => ({ ...createInitialState(), minWidth: 180, minHeight: 120 }), domController);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shortcuts, setShortcuts] = useState(loadSavedShortcuts());
  const keymap = useMemo(
    () => defaultPaneShortcutActions.flatMap(definition => {
      try {
        return [{
          sequence: normalizeShortcut(shortcuts[definition.id]),
          action: () => { definition.action(controller); },
          repeat: "repeat" in definition ? definition.repeat : undefined,
        }];
      } catch {
        return [];
      }
    }),
    [controller, shortcuts]
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
        domController={domController}
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
  controller,
  onToggleSidebar,
}: {
  sidebarOpen: boolean;
  controller: FocusGridController;
  onToggleSidebar: () => void;
}) {
  const state = useControllerState(controller);
  const paneIds = useMemo(() => collectPaneIds(state.root), [state.root]);
  const activePane = findPaneNode(state.root, state.activePaneId);
  const swapTargets = useMemo(
    () => paneIds.filter((paneId) => paneId !== state.activePaneId),
    [paneIds, state.activePaneId]
  );
  const [swapTargetId, setSwapTargetId] = useState(swapTargets[0] ?? "");

  useEffect(() => {
    if (swapTargetId && swapTargets.includes(swapTargetId)) {
      return;
    }

    setSwapTargetId(swapTargets[0] ?? "");
  }, [swapTargetId, swapTargets]);

  const toggleActivePaneCapability = useCallback(
    (key: PaneCommandCapability) => {
      const activePaneId = state.activePaneId;

      if (!activePaneId || !activePane) {
        return;
      }

      controller.updatePane(activePaneId, {
        [key]: !(activePane[key] ?? true),
      });
    },
    [activePane, controller, state.activePaneId]
  );

  return (
    <header className="Toolbar">
      <div className="ToolbarActions">
        <details className="ToolbarMenu">
          <summary>Actions</summary>
          <div className="ToolbarMenuPanel">
            <button type="button" onClick={onToggleSidebar}>
              {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            </button>
            <div className="ToolbarButtonGroup" aria-label="Split active pane">
              {cardinalDirections.map((side) => (
                <button
                  disabled={!activePane}
                  key={side}
                  type="button"
                  onClick={() => {
                    controller.split(activePane!.id, {
                      side,
                      preserveActivePane: true,
                    });
                  }}
                >
                  Split {side}
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

                controller.swap(activePaneId, swapTargetId);
              }}
            >
              Swap
            </button>
          </div>
        </details>
        <div className="GuardToggles" aria-label="Active pane command capabilities">
          {paneCapabilityToggles.map((capability) => (
            <button
              className="GuardToggle"
              data-active={
                activePane ? activePane[capability.key] !== false : false
              }
              aria-pressed={
                activePane ? activePane[capability.key] !== false : false
              }
              disabled={!activePane}
              key={capability.key}
              type="button"
              onClick={() => toggleActivePaneCapability(capability.key)}
            >
              {capability.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ToolbarMeta">
        <a className="ToolbarLink" href={demoHubPath}>
          All demos
        </a>
        <span>
          Root: {state.container.width} x {state.container.height}
        </span>
      </div>
    </header>
  );
}

const paneCapabilityToggles: { key: PaneCommandCapability; label: string }[] = [
  { key: PaneCommandCapability.ResizeX, label: "Can resize X" },
  { key: PaneCommandCapability.ResizeY, label: "Can resize Y" },
  { key: PaneCommandCapability.Remove, label: "Can remove" },
  { key: PaneCommandCapability.SplitHorizontal, label: "Can split right" },
  { key: PaneCommandCapability.SplitVertical, label: "Can split down" },
  { key: PaneCommandCapability.SwapX, label: "Can swap X" },
  { key: PaneCommandCapability.SwapY, label: "Can swap Y" },
  { key: PaneCommandCapability.Focus, label: "Can focus" },
];

function PaneSlot({ ctx }: { ctx: Pane }) {
  const Component = paneComponents[ctx.paneId] ?? TextPane;

  return <Component {...ctx} />;
}

function TextPane({ paneId, active, controller }: Pane) {
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
          controller.focus(paneId);
        }}
      />
    </section>
  );
}
