import type {
  FocusGridControllerState,
  LayoutNode,
  PaneCommandCapabilityInput,
  PaneId,
  PaneNode,
  SplitNode,
} from "../src";

export function paneNode(paneId: PaneId, capabilities: PaneCommandCapabilityInput = {}): PaneNode {
  return { kind: "pane", id: `${paneId}-node`, paneId, ...capabilities };
}

export function splitNode(
  id: string,
  orientation: SplitNode["orientation"],
  sizes: number[],
  children: LayoutNode[],
): SplitNode {
  return { kind: "split", id, orientation, sizes, children };
}

export function gridState(
  root: LayoutNode,
  activePaneId: PaneId | null,
  container = { width: 1000, height: 600 },
): FocusGridControllerState {
  return { root, activePaneId, container };
}
