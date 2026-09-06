import type {
  ComponentType,
  CSSProperties,
  PointerEvent,
  ReactNode,
} from "react";
import type {
  ComputedPane,
  FocusGridController,
  PaneId,
  Rect,
} from "@focusgrid/focusgrid/core";
import { shouldFocusPaneShellForPointer } from "@focusgrid/focusgrid/dom";

export type PaneRenderContext = {
  paneId: PaneId;
  rect: Rect;
  active: boolean;
  controller: FocusGridController;
};

export type PaneComponentProps = PaneRenderContext;
export type PaneComponent = ComponentType<PaneComponentProps>;

export type PaneViewProps = {
  controller: FocusGridController;
  pane: ComputedPane;
  renderPane: (ctx: PaneRenderContext) => ReactNode;
};

export function PaneView({ controller, pane, renderPane }: PaneViewProps) {
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
      tabIndex={-1}
      style={style}
      onPointerDown={(event) => {
        controller.api.focus(pane.paneId);
        focusPaneShellForNonInteractivePointer(event);
      }}
    >
      {renderPane({
        paneId: pane.paneId,
        rect: pane.rect,
        active: pane.active,
        controller,
      })}
    </div>
  );
}

function focusPaneShellForNonInteractivePointer(
  event: PointerEvent<HTMLDivElement>,
): void {
  if (
    event.target instanceof Element &&
    !shouldFocusPaneShellForPointer(event.target, event.currentTarget)
  ) {
    return;
  }

  event.currentTarget.focus({ preventScroll: true });
}
