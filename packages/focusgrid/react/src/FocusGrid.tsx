import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { FocusGridController, PaneLayoutChangeEvent, PaneCloseEvent } from "@andrewcyuan/focusgrid/core";
import { RootResizeObserver, type FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { useControllerLayout } from "./hooks";
import { ShortcutScope, useShortcuts } from "@andrewcyuan/shortcut-engine/react";
import type { ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import { createDefaultPaneKeymap } from "./default-pane-keymap";
import { PaneView } from "./PaneView";
import { ResizeHandle } from "./ResizeHandle";
import type { Pane } from "./PaneView";

export type FocusGridProps = {
  controller: FocusGridController;
  domController: FocusGridDomController;
  keymap?: readonly ShortcutBinding[];
  renderPane: (ctx: Pane) => ReactNode;
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
  domController,
}: FocusGridProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layout = useControllerLayout(controller);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    domController.setRoot(root);
    const observer = new RootResizeObserver(controller, root);
    observer.mount();
    return () => {
      observer.destroy();
      domController.setRoot(null);
    };
  }, [controller, domController]);

  useEffect(() => controller.subscribePaneEvents({ onPaneLayoutChange, onPaneClose }),
    [controller, onPaneLayoutChange, onPaneClose]);

  const rootClassName = className
    ? `FocusgridFocusGrid ${className}`
    : "FocusgridFocusGrid";

  return (
    <ShortcutScope ref={rootRef} className={rootClassName} onFocus={event => {
      const target = event.target;
      if (target.closest(".FocusgridFocusGrid") !== event.currentTarget) return;
      const paneId = target.closest<HTMLElement>("[data-pane-id]")?.dataset.paneId;
      if (paneId) controller.focus(paneId);
    }}>
        <GridShortcuts bindings={keymap ?? createDefaultPaneKeymap(controller)} />
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
    </ShortcutScope>
  );
}

function GridShortcuts({ bindings }: { bindings: readonly ShortcutBinding[] }) {
  useShortcuts(bindings);
  return null;
}
