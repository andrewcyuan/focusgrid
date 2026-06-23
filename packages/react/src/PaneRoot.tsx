import { useEffect, useRef, type ReactNode } from "react";
import type { KeyBinding } from "@focusgrid/core";
import { WorkspaceDomController } from "@focusgrid/dom";
import { useComputedLayout, useWorkspace } from "./hooks";
import { PaneView } from "./PaneView";
import { ResizeHandle } from "./ResizeHandle";

export type PaneRootProps = {
  renderPane: (paneId: string) => ReactNode;
  keymap?: KeyBinding[];
  className?: string;
};

export function PaneRoot({ renderPane, keymap, className }: PaneRootProps) {
  const workspace = useWorkspace();
  const rootRef = useRef<HTMLDivElement | null>(null);
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
