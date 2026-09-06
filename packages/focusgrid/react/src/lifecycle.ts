import type { ComputedPane, PaneId, FocusGridController } from "@focusgrid/focusgrid/core";
import { useEffect, useRef } from "react";

export type PaneLayoutChangeEvent = {
  pane: ComputedPane;
  previousPane: ComputedPane;
  controller: FocusGridController;
};

export type PaneCloseEvent = {
  paneId: PaneId;
  previousPane: ComputedPane;
  controller: FocusGridController;
};

export type PaneLifecycleDiff = {
  layoutChanges: Array<{
    pane: ComputedPane;
    previousPane: ComputedPane;
  }>;
  closedPanes: Array<{
    paneId: PaneId;
    previousPane: ComputedPane;
  }>;
};

export type PaneLifecycleSnapshot = {
  controller: FocusGridController;
  panes: Map<PaneId, ComputedPane>;
};

export function advancePaneLifecycle(
  previous: PaneLifecycleSnapshot | null,
  controller: FocusGridController,
  panes: ComputedPane[],
): { snapshot: PaneLifecycleSnapshot; diff: PaneLifecycleDiff } {
  const currentPanes = createPaneMap(panes);
  return {
    snapshot: { controller, panes: currentPanes },
    diff: previous && previous.controller === controller
      ? diffPaneLifecycle(previous.panes, currentPanes)
      : { layoutChanges: [], closedPanes: [] },
  };
}

export function usePaneLifecycleEvents(
  controller: FocusGridController,
  panes: ComputedPane[],
  onPaneLayoutChange?: (event: PaneLayoutChangeEvent) => void,
  onPaneClose?: (event: PaneCloseEvent) => void,
): void {
  const snapshotRef = useRef<PaneLifecycleSnapshot | null>(null);

  useEffect(() => {
    const { snapshot, diff } = advancePaneLifecycle(
      snapshotRef.current,
      controller,
      panes,
    );
    snapshotRef.current = snapshot;
    for (const change of diff.layoutChanges) {
      onPaneLayoutChange?.({ ...change, controller });
    }
    for (const closed of diff.closedPanes) {
      onPaneClose?.({ ...closed, controller });
    }
  }, [controller, panes, onPaneClose, onPaneLayoutChange]);
}

export function createPaneMap(panes: ComputedPane[]): Map<PaneId, ComputedPane> {
  return new Map(panes.map((pane) => [pane.paneId, pane]));
}

export function diffPaneLifecycle(
  previousPanes: Map<PaneId, ComputedPane>,
  currentPanes: Map<PaneId, ComputedPane>,
): PaneLifecycleDiff {
  const layoutChanges: PaneLifecycleDiff["layoutChanges"] = [];
  const closedPanes: PaneLifecycleDiff["closedPanes"] = [];

  for (const [paneId, pane] of currentPanes) {
    const previousPane = previousPanes.get(paneId);

    if (previousPane && didRectChange(previousPane, pane)) {
      layoutChanges.push({ pane, previousPane });
    }
  }

  for (const [paneId, previousPane] of previousPanes) {
    if (!currentPanes.has(paneId)) {
      closedPanes.push({ paneId, previousPane });
    }
  }

  return { layoutChanges, closedPanes };
}

function didRectChange(previousPane: ComputedPane, pane: ComputedPane): boolean {
  return (
    previousPane.rect.x !== pane.rect.x ||
    previousPane.rect.y !== pane.rect.y ||
    previousPane.rect.width !== pane.rect.width ||
    previousPane.rect.height !== pane.rect.height
  );
}
