import { useEffect, useRef, type ReactNode } from "react";
import type { PaneEventHandlers } from "@andrewcyuan/focusgrid/core";
import { mountFocusGrid } from "@andrewcyuan/focusgrid/dom";
import { ShortcutScope, useShortcuts } from "@andrewcyuan/shortcut-engine/react";
import type { ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import { createDefaultPaneKeymap } from "./default-pane-keymap";
import { useGridControllers } from "./FocusgridController";
import { useControllerLayout } from "./hooks";
import { PaneView, type Pane } from "./PaneView";

export type FocusGridProps = PaneEventHandlers & {
  keymap?: readonly ShortcutBinding[];
  renderPane: (ctx: Pane) => ReactNode;
  className?: string;
};

export function FocusGrid({ className, onPaneLayoutChange, onPaneClose, ...content }: FocusGridProps) {
  const { controller, domController } = useGridControllers();
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (root) return mountFocusGrid(root, controller, domController);
  }, [controller, domController]);
  useEffect(() => controller.subscribePaneEvents({ onPaneLayoutChange, onPaneClose }),
    [controller, onPaneLayoutChange, onPaneClose]);
  return (
    <ShortcutScope ref={rootRef} className={className ? `FocusgridFocusGrid ${className}` : "FocusgridFocusGrid"}>
      <GridContent {...content} />
    </ShortcutScope>
  );
}

function GridContent({ keymap, renderPane }: Pick<FocusGridProps, "keymap" | "renderPane">) {
  const { controller } = useGridControllers();
  const layout = useControllerLayout(controller);
  useShortcuts(keymap ?? createDefaultPaneKeymap(controller));
  return <PaneView node={layout.root} renderPane={renderPane} />;
}
