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
} from "@focusgrid/core";

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
  if (isInteractiveOrFocusableDescendant(event.target, event.currentTarget)) {
    return;
  }

  event.currentTarget.focus({ preventScroll: true });
}

function isInteractiveOrFocusableDescendant(
  target: EventTarget,
  paneShell: HTMLElement,
): boolean {
  if (!(target instanceof HTMLElement) || target === paneShell) {
    return false;
  }

  let element: HTMLElement | null = target;

  while (element && element !== paneShell) {
    if (isInteractiveOrFocusableElement(element)) {
      return true;
    }

    element = element.parentElement;
  }

  return false;
}

function isInteractiveOrFocusableElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role");

  return (
    element.isContentEditable ||
    element.tabIndex >= 0 ||
    tagName === "a" ||
    tagName === "button" ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    role === "button" ||
    role === "checkbox" ||
    role === "link" ||
    role === "menuitem" ||
    role === "option" ||
    role === "radio" ||
    role === "switch" ||
    role === "tab" ||
    role === "textbox"
  );
}
