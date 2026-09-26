import { createId } from "./utils/ids";
import { computeLayout } from "./layout/geometry";
import { resizeSplit } from "./layout/resize";
import { resolvePaneResizeBoundary } from "./layout/navigation";
import { isHorizontalDirection } from "./layout/spatial";
import {
  buildLayoutIndex,
  collectPaneIds,
  markFocusedPanePath,
  removePaneNode,
  transformLayout,
  updatePane,
  findPaneNode,
} from "./layout/tree";
import {
  paneCommandCapabilityKeys,
  type NodeId,
  type PaneId,
  type PaneNode,
  type CardinalDirection,
  type FocusGridControllerState,
} from "./layout/types";
import { assertValidFocusGridControllerState } from "./validation";

export type Listener = (next: FocusGridControllerState, previous: FocusGridControllerState) => void;
export type PaneDefaults = Omit<PaneNode, "kind" | "id" | "paneId" | "data">;
export type FocusGridControllerProps = FocusGridControllerState & {
  paneDefaults?: PaneDefaults;
  directionalFocusOverflow?: boolean;
};
export type SplitPaneOptions = Partial<Omit<PaneNode, "kind" | "id" | "paneId">> & {
  side: CardinalDirection;
  newPaneId?: PaneId;
  newPaneNodeId?: NodeId;
  splitId?: NodeId;
  preserveActivePane?: boolean;
};
export type ResizePaneOptions = { direction: CardinalDirection; deltaPx: number };
export type ResizeHandleOptions = { index: number; deltaPx: number; snapshotSizes?: number[] };

export class FocusGridController {
  readonly directionalFocusOverflow: boolean;
  private currentState: FocusGridControllerState;
  private readonly paneDefaults: PaneDefaults;
  private readonly listeners = new Set<Listener>();

  constructor({ paneDefaults = {}, directionalFocusOverflow = false, ...state }: FocusGridControllerProps) {
    assertValidFocusGridControllerState(state);
    this.paneDefaults = paneDefaults;
    this.directionalFocusOverflow = directionalFocusOverflow;
    const root = transformLayout(state.root, (node) =>
      node.kind === "pane" ? withPaneDefaults(node, paneDefaults) : node,
    );
    this.currentState = root === state.root ? state : { ...state, root };
  }

  split(paneNodeId: NodeId, props: SplitPaneOptions): PaneId | null {
    const state = this.currentState;
    const index = buildLayoutIndex(state.root);
    const target = index.nodeById.get(paneNodeId);
    if (target?.kind !== "pane") return null;
    const paneId = props.newPaneId ?? createId("pane");
    const id = props.newPaneNodeId ?? createId("node");
    const splitId = props.splitId ?? createId("split");
    if (index.paneNodeByPaneId.has(paneId) || index.nodeById.has(id) || index.nodeById.has(splitId) || id === splitId) return null;
    const { side, newPaneId, newPaneNodeId, splitId: suppliedSplitId, preserveActivePane, ...paneProps } = props;
    const pane = withPaneDefaults({ kind: "pane", id, paneId, ...paneProps }, {
      ...this.paneDefaults,
      minWidth: this.paneDefaults.minWidth ?? target.minWidth,
      minHeight: this.paneDefaults.minHeight ?? target.minHeight,
    });
    const root = updatePane(state.root, target.paneId, () => ({
      kind: "split", id: splitId,
      orientation: isHorizontalDirection(side) ? "horizontal" : "vertical",
      children: side === "left" || side === "up" ? [pane, target] : [target, pane],
      sizes: [0.5, 0.5],
    }));
    const activePaneId = preserveActivePane ? state.activePaneId : paneId;
    this.commit({ root: activePaneId ? markFocusedPanePath(root, activePaneId) : root, activePaneId });
    return paneId;
  }

  remove(paneId: PaneId): boolean {
    const state = this.currentState;
    const panes = collectPaneIds(state.root);
    if (!panes.includes(paneId) || panes.length <= 1) return false;
    const root = removePaneNode(state.root, paneId)!;
    const activePaneId = state.activePaneId === paneId ? collectPaneIds(root)[0]! : state.activePaneId;
    return this.commit({ root: activePaneId ? markFocusedPanePath(root, activePaneId) : root, activePaneId });
  }

  swap(firstPaneId: PaneId, secondPaneId: PaneId): boolean {
    if (firstPaneId === secondPaneId) return false;
    const state = this.currentState;
    const index = buildLayoutIndex(state.root);
    const first = index.paneNodeByPaneId.get(firstPaneId);
    const second = index.paneNodeByPaneId.get(secondPaneId);
    if (!first || !second) return false;
    const root = transformLayout(state.root, (node) => {
      if (node.id === first.id) return { ...second, id: node.id };
      if (node.id === second.id) return { ...first, id: node.id };
      return node;
    });
    return this.commit({ root: state.activePaneId ? markFocusedPanePath(root, state.activePaneId) : root });
  }

  resize(paneId: PaneId, props: ResizePaneOptions): boolean {
    const index = buildLayoutIndex(this.currentState.root);
    const pane = index.paneNodeByPaneId.get(paneId);
    if (!pane) return false;
    const boundary = resolvePaneResizeBoundary(index, pane.id, props.direction);
    return boundary ? this.resizeHandle(boundary.splitId, {
      index: boundary.index, deltaPx: boundary.deltaPxSign * props.deltaPx,
    }) : false;
  }

  resizeHandle(splitId: NodeId, props: ResizeHandleOptions): boolean {
    const state = this.currentState;
    const rect = computeLayout(state).rectByNodeId.get(splitId);
    if (!rect) return false;
    const root = transformLayout(state.root, (node) => node.kind === "split" && node.id === splitId
      ? resizeSplit(node, node.orientation === "horizontal" ? rect.width : rect.height, props.index, props.deltaPx, props.snapshotSizes)
      : node,
    );
    return this.commit({ root });
  }

  focus(paneId: PaneId): boolean {
    const state = this.currentState;
    if (!findPaneNode(state.root, paneId)) return false;
    const root = markFocusedPanePath(state.root, paneId);
    return this.commit({ root, activePaneId: paneId });
  }

  updatePane(
    paneId: PaneId,
    patch: Partial<Omit<PaneNode, "kind" | "id" | "paneId">>,
  ): boolean {
    const root = updatePane(this.currentState.root, paneId, (pane) =>
      Object.entries(patch).every(([key, value]) => Object.is(pane[key as keyof PaneNode], value))
        ? pane
        : Object.fromEntries(
          Object.entries({ ...pane, ...patch }).filter(([, value]) => value !== undefined),
        ) as PaneNode,
    );
    return this.commit({ root });
  }

  setContainerSize(width: number, height: number): boolean {
    if (this.currentState.container.width === width && this.currentState.container.height === height) return false;
    return this.commit({ container: { width, height } });
  }

  get state(): FocusGridControllerState {
    return this.currentState;
  }

  private commit(patch: Partial<FocusGridControllerState>): boolean {
    const previous = this.currentState;
    if (Object.entries(patch).every(([key, value]) => Object.is(previous[key as keyof FocusGridControllerState], value))) {
      return false;
    }

    const next = { ...previous, ...patch };
    this.currentState = next;

    for (const listener of this.listeners) {
      listener(next, previous);
    }

    return true;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

const paneDefaultKeys = ["minWidth", "minHeight", ...paneCommandCapabilityKeys] as const;

function withPaneDefaults(pane: PaneNode, defaults: PaneDefaults): PaneNode {
  let next = pane;
  for (const key of paneDefaultKeys) {
    if (pane[key] === undefined && defaults[key] !== undefined) {
      next = { ...next, [key]: defaults[key] };
    }
  }
  // An omitted optional field stays absent, including when a creation prop is undefined.
  if (Object.values(next).some((value) => value === undefined)) {
    next = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) as PaneNode;
  }
  return next;
}
