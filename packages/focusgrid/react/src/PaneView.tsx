import { ShortcutScope } from "@andrewcyuan/shortcut-engine/react";
import type { ReactElement, ReactNode } from "react";
import type { ComputedNode, ComputedPane, FocusGridController, PaneId, Rect } from "@andrewcyuan/focusgrid/core";
import { useGridControllers } from "./FocusgridController";
import { ResizeHandle } from "./ResizeHandle";

export type Pane = {
  paneId: PaneId;
  rect: Rect;
  active: boolean;
  controller: FocusGridController;
};

type RenderPane = (pane: Pane) => ReactNode;

export function PaneView({ node, renderPane }: { node: ComputedNode; renderPane: RenderPane }) {
  return renderNode(node, renderPane);
}

// Flatten only the rendered siblings, keeping pane keys stable when splits move.
// Nested component boundaries would remount editors on split, collapse, or swap.
function renderNode(node: ComputedNode, renderPane: RenderPane): ReactElement[] {
  if (node.kind === "pane") {
    return [<PaneShell key={`pane:${node.pane.paneId}`} pane={node.pane} renderPane={renderPane} />];
  }
  return node.children.flatMap((child, index) => [
    ...renderNode(child, renderPane),
    ...(node.handles[index] ? [<ResizeHandle key={`handle:${node.handles[index].id}`} handle={node.handles[index]} />] : []),
  ]);
}

function PaneShell({ pane, renderPane }: { pane: ComputedPane; renderPane: RenderPane }) {
  const { controller } = useGridControllers();
  return (
    <ShortcutScope
      className="FocusgridPaneView"
      data-active={pane.active}
      data-pane-id={pane.paneId}
      tabIndex={-1}
      style={{ left: pane.rect.x, top: pane.rect.y, width: pane.rect.width, height: pane.rect.height }}
    >
      {renderPane({ paneId: pane.paneId, rect: pane.rect, active: pane.active, controller })}
    </ShortcutScope>
  );
}
