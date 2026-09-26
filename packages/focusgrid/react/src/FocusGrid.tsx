import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { FocusGridController, PaneLayoutChangeEvent, PaneCloseEvent } from "@andrewcyuan/focusgrid/core";
import { mountFocusGrid, type FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
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
    return mountFocusGrid(root, controller, domController);
  }, [controller, domController]);

  useEffect(() => controller.subscribePaneEvents({ onPaneLayoutChange, onPaneClose }),
    [controller, onPaneLayoutChange, onPaneClose]);

  const rootClassName = className
    ? `FocusgridFocusGrid ${className}`
    : "FocusgridFocusGrid";

  return (
    <ShortcutScope ref={rootRef} className={rootClassName}>
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
