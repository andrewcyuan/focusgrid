import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { FocusGridController } from "@andrewcyuan/focusgrid/core";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { useControllerLayout } from "./hooks";
import {
  usePaneLifecycleEvents,
  type PaneCloseEvent,
  type PaneLayoutChangeEvent,
} from "./lifecycle";
import { ShortcutScope, useShortcuts } from "@andrewcyuan/shortcut-engine/react";
import type { ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import { createDefaultPaneKeymap } from "./default-pane-keymap";
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
  }, [controller, focusManagementMode, focusManagementScopeRef]);

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
    <ShortcutScope ref={rootRef} className={rootClassName}>
        <GridShortcuts bindings={keymap ?? createDefaultPaneKeymap(controller)} />
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
    </ShortcutScope>
  );
}

function GridShortcuts({ bindings }: { bindings: readonly ShortcutBinding[] }) {
  useShortcuts(bindings);
  return null;
}
