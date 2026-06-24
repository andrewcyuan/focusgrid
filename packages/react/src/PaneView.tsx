import type { CSSProperties, ReactNode } from "react";
import type { ComputedPane, PaneId, Rect, Workspace } from "@focusgrid/core";
import { useWorkspace } from "./hooks";

export type PaneRenderContext = {
  paneId: PaneId;
  rect: Rect;
  active: boolean;
  workspace: Workspace;
};

export type PaneViewProps = {
  pane: ComputedPane;
  renderPane: (ctx: PaneRenderContext) => ReactNode;
};

export function PaneView({ pane, renderPane }: PaneViewProps) {
  const workspace = useWorkspace();
  const style: CSSProperties = {
    left: pane.rect.x,
    top: pane.rect.y,
    width: pane.rect.width,
    height: pane.rect.height,
  };

  return (
    <div
      className="FocusgridPaneView"
      data-active={pane.active}
      data-pane-id={pane.paneId}
      style={style}
      onPointerDown={() => {
        workspace.dispatch({
          type: "pane.focus",
          paneId: pane.paneId,
        });
      }}
    >
      {renderPane({
        paneId: pane.paneId,
        rect: pane.rect,
        active: pane.active,
        workspace,
      })}
    </div>
  );
}
