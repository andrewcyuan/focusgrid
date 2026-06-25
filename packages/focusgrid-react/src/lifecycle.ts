import type { ComputedPane, PaneId, Workspace } from "@focusgrid/core";

export type PaneLayoutChangeEvent = {
  pane: ComputedPane;
  previousPane: ComputedPane;
  workspace: Workspace;
};

export type PaneCloseEvent = {
  paneId: PaneId;
  previousPane: ComputedPane;
  workspace: Workspace;
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
