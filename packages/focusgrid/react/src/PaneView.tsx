import { ShortcutScope } from "@andrewcyuan/shortcut-engine/react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import type {
  ComputedPane,
  FocusGridController,
  PaneId,
  Rect,
} from "@andrewcyuan/focusgrid/core";

export type Pane = {
  paneId: PaneId;
  rect: Rect;
  active: boolean;
  controller: FocusGridController;
};

type PaneViewProps = {
  controller: FocusGridController;
  pane: ComputedPane;
  renderPane: (ctx: Pane) => ReactNode;
};

export function PaneView({ controller, pane, renderPane }: PaneViewProps) {
  const style: CSSProperties = {
    left: pane.rect.x,
    top: pane.rect.y,
    width: pane.rect.width,
    height: pane.rect.height,
  };

  return (
    <ShortcutScope
      className="FocusgridPaneView"
      data-active={pane.active}
      data-pane-id={pane.paneId}
      tabIndex={-1}
      style={style}

    >
      {renderPane({
        paneId: pane.paneId,
        rect: pane.rect,
        active: pane.active,
        controller,
      })}
    </ShortcutScope>
  );
}
