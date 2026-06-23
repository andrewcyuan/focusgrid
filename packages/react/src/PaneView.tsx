import type { CSSProperties, ReactNode } from "react";
import type { ComputedPane } from "@focusgrid/core";
import { useWorkspace } from "./hooks";

export type PaneViewProps = {
  pane: ComputedPane;
  renderPane: (paneId: string) => ReactNode;
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
      {renderPane(pane.paneId)}
    </div>
  );
}
