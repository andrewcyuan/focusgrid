export type PaneId = string;
export type NodeId = string;

export type Orientation = "horizontal" | "vertical";
export const cardinalDirections = ["left", "right", "up", "down"] as const;

export type CardinalDirection = (typeof cardinalDirections)[number];
export enum PaneCommandCapability {
  ResizeX = "canResizeX",
  ResizeY = "canResizeY",
  Remove = "canRemove",
  SplitHorizontal = "canSplitHorizontal",
  SplitVertical = "canSplitVertical",
  SwapX = "canSwapX",
  SwapY = "canSwapY",
  Focus = "canFocus",
}

export type PaneCommandCapabilityInput = Partial<Record<PaneCommandCapability, boolean>>;

export type PaneNode = {
  kind: "pane";
  id: NodeId;
  paneId: PaneId;
} & PaneCommandCapabilityInput;

export type SplitNode = {
  kind: "split";
  id: NodeId;
  orientation: Orientation;
  children: LayoutNode[];
  sizes: number[];
  lastFocusedChildId?: NodeId;
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
  direction: Orientation;
};

export type ComputedNode =
  | { kind: "pane"; pane: ComputedPane }
  | { kind: "split"; orientation: Orientation; children: ComputedNode[]; handles: ComputedHandle[] };

export type ComputedLayout = {
  root: ComputedNode;
  rectByNodeId: Map<NodeId, Rect>;
  panes: ComputedPane[];
  handles: ComputedHandle[];
};

export type FocusGridControllerState = {
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
