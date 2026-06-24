import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { ComputedPane, KeyBinding, PaneId } from "@focusgrid/core";
import { WorkspaceDomController } from "@focusgrid/dom";
import { useComputedLayout, useWorkspace } from "./hooks";
import {
  createPaneMap,
  diffPaneLifecycle,
  type PaneCloseEvent,
  type PaneLayoutChangeEvent,
} from "./lifecycle";
import { PaneView } from "./PaneView";
import { ResizeHandle } from "./ResizeHandle";
import type { PaneRenderContext } from "./PaneView";

export type PaneRootProps = {
  renderPane: (ctx: PaneRenderContext) => ReactNode;
  keymap?: KeyBinding[];
  className?: string;
  onPaneLayoutChange?: (event: PaneLayoutChangeEvent) => void;
  onPaneClose?: (event: PaneCloseEvent) => void;
};

export function PaneRoot({
  renderPane,
  keymap,
  className,
  onPaneLayoutChange,
  onPaneClose,
}: PaneRootProps) {
  const workspace = useWorkspace();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousPaneMapRef = useRef<Map<PaneId, ComputedPane> | null>(
    null,
  );
  const layout = useComputedLayout();

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const controller = new WorkspaceDomController(workspace, rootRef.current, {
      keymap,
    });

    controller.mount();
    return () => controller.destroy();
  }, [workspace, keymap]);

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
        workspace,
      });
    }

    for (const closed of diff.closedPanes) {
      onPaneClose?.({
        ...closed,
        workspace,
      });
    }

    previousPaneMapRef.current = currentPaneMap;
  }, [layout.panes, onPaneClose, onPaneLayoutChange, workspace]);

  const rootClassName = className
    ? `FocusgridPaneRoot ${className}`
    : "FocusgridPaneRoot";

  return (
    <div ref={rootRef} className={rootClassName}>
      {layout.panes.map((pane) => (
        <PaneView key={pane.paneId} pane={pane} renderPane={renderPane} />
      ))}

      {layout.handles.map((handle) => (
        <ResizeHandle key={handle.id} handle={handle} />
      ))}
    </div>
  );
}
