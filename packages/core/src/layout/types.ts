export type PaneId = string;
export type NodeId = string;

export type Direction = "horizontal" | "vertical";
export type PaneFocusDirection = "left" | "right" | "up" | "down";
export type PaneResizeDirection = "left" | "right" | "up" | "down";

export type PaneNode = {
  kind: "pane";
  id: NodeId;
  paneId: PaneId;
  minWidth?: number;
  minHeight?: number;
  data?: unknown;
};

export type SplitNode = {
  kind: "split";
  id: NodeId;
  direction: Direction;
  children: LayoutNode[];
  sizes: number[];
};

export type LayoutNode = PaneNode | SplitNode;

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ComputedPane = {
  paneId: PaneId;
  nodeId: NodeId;
  rect: Rect;
  active: boolean;
};

export type ComputedHandle = {
  id: string;
  splitId: NodeId;
  index: number;
  rect: Rect;
  direction: Direction;
};

export type ComputedLayout = {
  panes: ComputedPane[];
  handles: ComputedHandle[];
};

export type WorkspaceState = {
  root: LayoutNode;
  activePaneId: PaneId | null;
  container: {
    width: number;
    height: number;
  };
};

export type LayoutIndex = {
  nodeById: Map<NodeId, LayoutNode>;
  paneNodeByPaneId: Map<PaneId, PaneNode>;
  parentByNodeId: Map<NodeId, SplitNode | null>;
};
