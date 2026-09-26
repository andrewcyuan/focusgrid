import { createId } from "./utils/ids";
import { computeLayout } from "./layout/geometry";
import { resizeSplit } from "./layout/resize";
import { findPaneForFocusCommand, findPaneInDirection, resolvePaneResizeBoundary } from "./layout/navigation";
import { isHorizontalDirection } from "./layout/spatial";
import {
  buildLayoutIndex,
  collectPaneIds,
  markFocusedPanePath,
  removePaneNode,
  transformLayout,
  updatePane,
  findPaneNode,
  findSplitNode,
} from "./layout/tree";
import {
  PaneCommandCapability,
  type PaneCommandCapabilityInput,
  type NodeId,
  type PaneId,
  type PaneNode,
  type ComputedLayout,
  type CardinalDirection,
  type FocusGridControllerState,
} from "./layout/types";
import { assertValidFocusGridControllerState } from "./validation";

export interface DomController {
  focus(paneId: PaneId): boolean;
}

export type Listener = (next: FocusGridControllerState, previous: FocusGridControllerState) => void;
export type PaneDefaults = PaneCommandCapabilityInput;
export type FocusGridControllerProps = FocusGridControllerState & {
  paneDefaults?: PaneDefaults;
  minWidth?: number;
  minHeight?: number;
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
  readonly minWidth: number;
  readonly minHeight: number;
  readonly directionalFocusOverflow: boolean;
  private currentState: FocusGridControllerState;
  private layout: ComputedLayout | null = null;
  private readonly paneDefaults: PaneDefaults;
  private readonly listeners = new Set<Listener>();

  constructor({ paneDefaults = {}, minWidth = 0, minHeight = 0, directionalFocusOverflow = false, ...state }: FocusGridControllerProps, private readonly domController: DomController) {
    assertValidFocusGridControllerState(state);
    if (![minWidth, minHeight].every(value => Number.isFinite(value) && value >= 0)) {
      throw new RangeError("Minimum pane dimensions must be finite, non-negative numbers.");
    }
    this.minWidth = minWidth;
    this.minHeight = minHeight;
    this.paneDefaults = paneDefaults;
    this.directionalFocusOverflow = directionalFocusOverflow;
    const root = transformLayout(state.root, (node) =>
      node.kind === "pane" ? withPaneDefaults(node, paneDefaults) : node,
    );
    this.currentState = root === state.root ? state : { ...state, root };
  }

  /** Computed render data; stable until the next committed change. */
  getLayout(): ComputedLayout {
    return this.layout ??= computeLayout(this.currentState);
  }

  getPane(paneId: PaneId): PaneNode | null {
    const pane = findPaneNode(this.currentState.root, paneId);
    return pane ? { ...pane } : null;
  }

  getContainerSize(): { width: number; height: number } {
    return { ...this.currentState.container };
  }

  getSplitSizes(splitId: NodeId): number[] | null {
    const split = findSplitNode(this.currentState.root, splitId);
    return split ? [...split.sizes] : null;
  }

  splitActive(side: CardinalDirection): PaneId | null {
    const pane = findPaneNode(this.currentState.root, this.currentState.activePaneId);
    const capability = isHorizontalDirection(side) ? PaneCommandCapability.SplitHorizontal : PaneCommandCapability.SplitVertical;
    return pane && pane[capability] !== false ? this.split(pane.id, { side }) : null;
  }

  removeActive(): boolean {
    const pane = findPaneNode(this.currentState.root, this.currentState.activePaneId);
    return pane && pane[PaneCommandCapability.Remove] !== false ? this.remove(pane.paneId) : false;
  }

  focusAdjacent(direction: CardinalDirection): boolean {
    const state = this.currentState;
    if (!state.activePaneId) return false;
    const target = findPaneForFocusCommand(state, state.activePaneId, direction, this.directionalFocusOverflow);
    if (!target || !this.domController.focus(target)) return false;
    this.focus(target);
    return true;
  }

  swapAdjacent(direction: CardinalDirection): boolean {
    const state = this.currentState;
    const active = findPaneNode(state.root, state.activePaneId);
    if (!active) return false;
    const targetId = findPaneInDirection(state, active.paneId, direction);
    const target = findPaneNode(state.root, targetId);
    const capability = isHorizontalDirection(direction) ? PaneCommandCapability.SwapX : PaneCommandCapability.SwapY;
    return target && active[capability] !== false && target[capability] !== false
      ? this.swap(active.paneId, target.paneId) : false;
  }

  resizeActive(direction: CardinalDirection, deltaPx: number): boolean {
    const pane = findPaneNode(this.currentState.root, this.currentState.activePaneId);
    const capability = isHorizontalDirection(direction) ? PaneCommandCapability.ResizeX : PaneCommandCapability.ResizeY;
    return pane && pane[capability] !== false ? this.resize(pane.paneId, { direction, deltaPx }) : false;
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
    const pane = withPaneDefaults({ kind: "pane", id, paneId, ...paneProps }, this.paneDefaults);
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
      ? resizeSplit(node, node.orientation === "horizontal" ? rect.width : rect.height, props.index, props.deltaPx, props.snapshotSizes, this.minWidth, this.minHeight)
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

  private commit(patch: Partial<FocusGridControllerState>): boolean {
    const previous = this.currentState;
    if (Object.entries(patch).every(([key, value]) => Object.is(previous[key as keyof FocusGridControllerState], value))) {
      return false;
    }

    const next = { ...previous, ...patch };
    this.currentState = next;
    this.layout = null;

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

function withPaneDefaults(pane: PaneNode, defaults: PaneDefaults): PaneNode {
  const definedPane = Object.fromEntries(Object.entries(pane).filter(([, value]) => value !== undefined)) as PaneNode;
  const next = Object.fromEntries(Object.entries({ ...defaults, ...definedPane }).filter(([, value]) => value !== undefined)) as PaneNode;
  return Object.keys(next).length === Object.keys(pane).length &&
    Object.entries(next).every(([key, value]) => Object.is(pane[key as keyof PaneNode], value))
    ? pane : next;
}
