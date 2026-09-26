import {
  useEffect,
  useContext,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { FocusGridController, ShortcutBinding } from "@andrewcyuan/focusgrid/core";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { useControllerLayout } from "./hooks";
import {
  usePaneLifecycleEvents,
  type PaneCloseEvent,
  type PaneLayoutChangeEvent,
} from "./lifecycle";
import { ShortcutScopeContext, useShortcutEngine } from "./shortcuts";
import { PaneView } from "./PaneView";
import { ResizeHandle } from "./ResizeHandle";
import type { Pane } from "./PaneView";

export type FocusGridFocusManagement = {
  mode: "application";
  scopeRef: RefObject<HTMLElement | null>;
};

export type FocusGridProps = {
  controller: FocusGridController;
  keymap?: readonly ShortcutBinding[];
  renderPane: (ctx: Pane) => ReactNode;
  className?: string;
  onPaneLayoutChange?: (event: PaneLayoutChangeEvent) => void;
  onPaneClose?: (event: PaneCloseEvent) => void;
  focusManagement?: FocusGridFocusManagement;
};

export function FocusGrid({
  controller,
  keymap,
  renderPane,
  className,
  onPaneLayoutChange,
  onPaneClose,
  focusManagement,
}: FocusGridProps) {
  const engine = useShortcutEngine();
  const parentScopeId = useContext(ShortcutScopeContext);
  const scopeId = useId();
  const domControllerRef = useRef<FocusGridDomController | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layout = useControllerLayout(controller);
  const focusManagementMode = focusManagement?.mode;
  const focusManagementScopeRef = focusManagement?.scopeRef;

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const root = rootRef.current;
    const scope = focusManagementScopeRef?.current ?? null;

    const domController = new FocusGridDomController(controller, root, {
      engine,
      scopeId,
      parentScopeId,
      focusManagement: focusManagementMode === "application"
        ? { mode: "application", scope }
        : undefined,
    });

    domController.mount();
    domControllerRef.current = domController;
    return () => {
      domController.destroy();
      domControllerRef.current = null;
    };
  }, [controller, engine, scopeId, parentScopeId, focusManagementMode, focusManagementScopeRef]);
  useEffect(() => {
    domControllerRef.current?.setKeymap(keymap ?? []);
  });

  usePaneLifecycleEvents(
    controller,
    layout.panes,
    onPaneLayoutChange,
    onPaneClose,
  );

  const rootClassName = className
    ? `FocusgridFocusGrid ${className}`
    : "FocusgridFocusGrid";

  return (
    <ShortcutScopeContext.Provider value={scopeId}>
      <div ref={rootRef} className={rootClassName}>
        {layout.panes.map((pane) => (
          <PaneView
            key={pane.paneId}
            controller={controller}
            pane={pane}
            renderPane={renderPane}
          />
        ))}

        {layout.handles.map((handle) => (
          <ResizeHandle
            key={handle.id}
            controller={controller}
            handle={handle}
          />
        ))}
      </div>
    </ShortcutScopeContext.Provider>
  );
}
