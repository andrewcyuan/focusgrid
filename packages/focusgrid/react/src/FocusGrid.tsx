import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { FocusGridController, KeyBinding } from "@focusgrid/focusgrid/core";
import { FocusGridDomController } from "@focusgrid/focusgrid/dom";
import { useControllerLayout } from "./hooks";
import {
  usePaneLifecycleEvents,
  type PaneCloseEvent,
  type PaneLayoutChangeEvent,
} from "./lifecycle";
import { PaneView } from "./PaneView";
import { ResizeHandle } from "./ResizeHandle";
import type { PaneRenderContext } from "./PaneView";

export type FocusGridFocusManagement = {
  mode: "application";
  scopeRef: RefObject<HTMLElement | null>;
};

export type FocusGridProps = {
  controller: FocusGridController;
  keymap?: KeyBinding[];
  renderPane: (ctx: PaneRenderContext) => ReactNode;
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
      keymap,
      focusManagement: focusManagementMode === "application"
        ? { mode: "application", scope }
        : undefined,
    });

    domController.mount();
    return () => domController.destroy();
  }, [controller, keymap, focusManagementMode, focusManagementScopeRef]);

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
  );
}
