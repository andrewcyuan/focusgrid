import { ShortcutScope } from "@andrewcyuan/shortcut-engine/react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import type {
  ComputedHandle,
  ComputedNode,
  ComputedPane,
  FocusGridController,
  PaneId,
  Rect,
} from "@andrewcyuan/focusgrid/core";
import { useGridControllers } from "./FocusgridController";

export type Pane = {
  paneId: PaneId;
  rect: Rect;
  active: boolean;
  controller: FocusGridController;
};

type RenderPane = (pane: Pane) => ReactNode;

// Flatten only the rendered siblings, keeping pane keys stable when splits move.
// Nested component boundaries would remount editors on split, collapse, or swap.
export function renderNode(node: ComputedNode, renderPane: RenderPane): ReactElement[] {
  if (node.kind === "pane") {
    return [<PaneShell key={`pane:${node.pane.paneId}`} pane={node.pane} renderPane={renderPane} />];
  }
  return node.children.flatMap((child, index) => {
    const elements = renderNode(child, renderPane);
    const handle = node.handles[index];
    return handle ? [...elements, <ResizeHandle key={`handle:${handle.id}`} handle={handle} />] : elements;
  });
}

function rectStyle(rect: Rect): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

function PaneShell({ pane, renderPane }: { pane: ComputedPane; renderPane: RenderPane }) {
  const { controller } = useGridControllers();
  return (
    <ShortcutScope
      className="FocusgridPaneView"
      data-active={pane.active}
      data-pane-id={pane.paneId}
      tabIndex={-1}
      style={rectStyle(pane.rect)}
    >
      {renderPane({ paneId: pane.paneId, rect: pane.rect, active: pane.active, controller })}
    </ShortcutScope>
  );
}

function ResizeHandle({ handle }: { handle: ComputedHandle }) {
  return (
    <div
      className="FocusgridResizeHandle"
      data-direction={handle.direction}
      style={rectStyle(handle.rect)}
      role="separator"
      aria-orientation={handle.direction === "horizontal" ? "vertical" : "horizontal"}
      data-resize-handle={handle.id}
    />
  );
}
