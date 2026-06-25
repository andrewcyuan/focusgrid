import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type {
  ComputedPane,
  FocusGridController,
  KeyBinding,
  PaneId,
} from "@focusgrid/core";
import { FocusGridDomController } from "@focusgrid/dom";
import { useControllerLayout } from "./hooks";
import {
  createPaneMap,
  diffPaneLifecycle,
  type PaneCloseEvent,
  type PaneLayoutChangeEvent,
} from "./lifecycle";
import { PaneView } from "./PaneView";
import { ResizeHandle } from "./ResizeHandle";
import type { PaneRenderContext } from "./PaneView";

export type FocusGridProps = {
  controller: FocusGridController;
  keymap?: KeyBinding[];
  renderPane: (ctx: PaneRenderContext) => ReactNode;
  className?: string;
  onPaneLayoutChange?: (event: PaneLayoutChangeEvent) => void;
  onPaneClose?: (event: PaneCloseEvent) => void;
};

export function FocusGrid({
  controller,
  keymap,
  renderPane,
  className,
  onPaneLayoutChange,
  onPaneClose,
}: FocusGridProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousPaneMapRef = useRef<Map<PaneId, ComputedPane> | null>(
    null,
  );
  const layout = useControllerLayout(controller);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const domController = new FocusGridDomController(controller, rootRef.current, {
      keymap,
    });

    domController.mount();
    return () => domController.destroy();
  }, [controller, keymap]);

  useLayoutEffect(() => {
    const currentPaneMap = createPaneMap(layout.panes);
    const previousPaneMap = previousPaneMapRef.current;

    if (!previousPaneMap) {
      previousPaneMapRef.current = currentPaneMap;
      return;
    }

    const diff = diffPaneLifecycle(previousPaneMap, currentPaneMap);

    for (const change of diff.layoutChanges) {
      onPaneLayoutChange?.({
        ...change,
        controller,
      });
    }

    for (const closed of diff.closedPanes) {
      onPaneClose?.({
        ...closed,
        controller,
      });
    }

    previousPaneMapRef.current = currentPaneMap;
  }, [controller, layout.panes, onPaneClose, onPaneLayoutChange]);

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
