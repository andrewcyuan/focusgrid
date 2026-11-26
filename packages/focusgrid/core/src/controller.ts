import { createId } from "./utils/ids";
import { computeLayout } from "./layout/geometry";
import { getMinimumSize, resizeSplit } from "./layout/resize";
import {
  findPaneForFocusCommand,
  findPaneInDirection,
  isForwardDirection,
  isHorizontalDirection,
  nearestSplitsOnAxis,
} from "./layout/navigation";
import {
  collectPaneIds,
  findNode,
  findPaneNode,
  findPanePath,
  markFocusedPanePath,
  removePaneNode,
  transformLayout,
  updatePane,
} from "./layout/tree";
import {
  PaneCommandCapability,
  type PaneCommandCapabilityInput,
  type NodeId,
  type PaneId,
  type PaneNode,
  type ComputedLayout,
  type ComputedPane,
  type CardinalDirection,
  type FocusGridControllerState,
  type SplitNode,
} from "./layout/types";
import { FocusGridStateValidationException, validateFocusGridControllerState } from "./validation";

export interface DomController {
  focus(paneId: PaneId): boolean;
}

export type Listener = (next: FocusGridControllerState, previous: FocusGridControllerState) => void;
export type PaneLayoutChangeEvent = { pane: ComputedPane; previousPane: ComputedPane; controller: FocusGridController };
export type PaneCloseEvent = { paneId: PaneId; previousPane: ComputedPane; controller: FocusGridController };
export type PaneEventHandlers = {
  onPaneLayoutChange?: (event: PaneLayoutChangeEvent) => void;
  onPaneClose?: (event: PaneCloseEvent) => void;
};
export type FocusGridControllerProps = FocusGridControllerState & {
  paneDefaults?: PaneCommandCapabilityInput;
  minWidth?: number;
  minHeight?: number;
  directionalFocusOverflow?: boolean;
};
export type SplitPaneOptions = PaneCommandCapabilityInput & {
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
  private readonly directionalFocusOverflow: boolean;
  private currentState: FocusGridControllerState;
  private cachedLayout: ComputedLayout | null = null;
  private readonly paneDefaults: PaneCommandCapabilityInput;
  private readonly listeners = new Set<Listener>();

  constructor(
    {
      paneDefaults = {},
      minWidth = 0,
      minHeight = 0,
      directionalFocusOverflow = false,
      ...state
    }: FocusGridControllerProps,
    private readonly domController: DomController,
  ) {
    const validation = validateFocusGridControllerState(state);
    if (!validation.ok) throw new FocusGridStateValidationException(validation.errors);
    if (![minWidth, minHeight].every((value) => Number.isFinite(value) && value >= 0)) {
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

  getLayout(): ComputedLayout {
    return (this.cachedLayout ??= computeLayout(this.currentState));
  }

  getPane(paneId: PaneId): PaneNode | null {
    const pane = findPaneNode(this.currentState.root, paneId);
    return pane ? { ...pane } : null;
  }

  getContainerSize(): { width: number; height: number } {
    return { ...this.currentState.container };
  }

  getSplitSizes(splitId: NodeId): number[] | null {
    const split = findNode(this.currentState.root, splitId);
    return split?.kind === "split" ? [...split.sizes] : null;
  }

  splitActive(side: CardinalDirection): PaneId | null {
    const pane = findPaneNode(this.currentState.root, this.currentState.activePaneId);
    const capability = isHorizontalDirection(side)
      ? PaneCommandCapability.SplitHorizontal
      : PaneCommandCapability.SplitVertical;
    return pane && pane[capability] !== false ? this.split(pane.id, { side }) : null;
  }

  removeActive(): boolean {
    const pane = findPaneNode(this.currentState.root, this.currentState.activePaneId);
    return pane && pane[PaneCommandCapability.Remove] !== false ? this.remove(pane.paneId) : false;
  }

  focusAdjacent(direction: CardinalDirection): boolean {
    const state = this.currentState;
    if (!state.activePaneId) return false;
    const target = findPaneForFocusCommand(
      state.root,
      this.getLayout(),
      state.activePaneId,
      direction,
      this.directionalFocusOverflow,
    );
    if (!target || !this.domController.focus(target)) return false;
    this.focus(target);
    return true;
  }

  swapAdjacent(direction: CardinalDirection): boolean {
    const state = this.currentState;
    const active = findPaneNode(state.root, state.activePaneId);
    if (!active) return false;
    const targetId = findPaneInDirection(state.root, this.getLayout(), active.paneId, direction);
    const target = findPaneNode(state.root, targetId);
    const capability = isHorizontalDirection(direction) ? PaneCommandCapability.SwapX : PaneCommandCapability.SwapY;
    return target && active[capability] !== false && target[capability] !== false
      ? this.swap(active.paneId, target.paneId)
      : false;
  }

  resizeActive(direction: CardinalDirection, deltaPx: number): boolean {
    const pane = findPaneNode(this.currentState.root, this.currentState.activePaneId);
    const capability = isHorizontalDirection(direction) ? PaneCommandCapability.ResizeX : PaneCommandCapability.ResizeY;
    return pane && pane[capability] !== false ? this.resize(pane.paneId, { direction, deltaPx }) : false;
  }

  split(
    paneNodeId: NodeId,
    {
      side,
      newPaneId,
      newPaneNodeId,
      splitId: requestedSplitId,
      preserveActivePane,
      ...capabilities
    }: SplitPaneOptions,
  ): PaneId | null {
    const state = this.currentState;
    const target = findNode(state.root, paneNodeId);
    if (target?.kind !== "pane") return null;
    const paneId = newPaneId ?? createId("pane");
    const id = newPaneNodeId ?? createId("node");
    const splitId = requestedSplitId ?? createId("split");
    if (findPaneNode(state.root, paneId) || findNode(state.root, id) || findNode(state.root, splitId) || id === splitId)
      return null;
    const pane = withPaneDefaults({ kind: "pane", id, paneId, ...capabilities }, this.paneDefaults);
    const horizontal = isHorizontalDirection(side);
    const split: SplitNode = {
      kind: "split",
      id: splitId,
      orientation: horizontal ? "horizontal" : "vertical",
      children: isForwardDirection(side) ? [target, pane] : [pane, target],
      sizes: [0.5, 0.5],
    };
    const paneMinSize = horizontal ? this.minWidth : this.minHeight;
    const { width: containerWidth, height: containerHeight } = state.container;
    const measured = containerWidth > 0 && containerHeight > 0;
    const rect = this.getLayout().rectByNodeId.get(target.id)!;
    const available = horizontal ? rect.width : rect.height;
    if (measured && paneMinSize > 0 && available < getMinimumSize(split, split.orientation, paneMinSize)) return null;
    const root = updatePane(state.root, target.paneId, () => split);
    const activePaneId = preserveActivePane ? state.activePaneId : paneId;
    this.commit({ root: markFocusedPanePath(root, activePaneId), activePaneId });
    return paneId;
  }

  remove(paneId: PaneId): boolean {
    const state = this.currentState;
    const panes = collectPaneIds(state.root);
    if (!panes.includes(paneId) || panes.length <= 1) return false;
    const root = removePaneNode(state.root, paneId)!;
    const activePaneId = state.activePaneId === paneId ? collectPaneIds(root)[0]! : state.activePaneId;
    return this.commit({ root: markFocusedPanePath(root, activePaneId), activePaneId });
  }

  swap(firstPaneId: PaneId, secondPaneId: PaneId): boolean {
    if (firstPaneId === secondPaneId) return false;
    const state = this.currentState;
    const first = findPaneNode(state.root, firstPaneId);
    const second = findPaneNode(state.root, secondPaneId);
    if (!first || !second) return false;
    const root = transformLayout(state.root, (node) => {
      if (node.id === first.id) return { ...second, id: node.id };
      if (node.id === second.id) return { ...first, id: node.id };
      return node;
    });
    return this.commit({ root: markFocusedPanePath(root, state.activePaneId) });
  }

  resize(paneId: PaneId, { direction, deltaPx }: ResizePaneOptions): boolean {
    const path = findPanePath(this.currentState.root, paneId);
    const nearest = path ? nearestSplitsOnAxis(path, direction)[0] : undefined;
    if (!nearest) return false;
    return this.resizeHandle(nearest.split.id, {
      index: Math.max(0, nearest.childIndex - 1),
      deltaPx: isForwardDirection(direction) ? deltaPx : -deltaPx,
    });
  }

  resizeHandle(splitId: NodeId, props: ResizeHandleOptions): boolean {
    const state = this.currentState;
    const rect = this.getLayout().rectByNodeId.get(splitId);
    if (!rect) return false;
    const root = transformLayout(state.root, (node) =>
      node.kind === "split" && node.id === splitId
        ? resizeSplit(
            node,
            node.orientation === "horizontal" ? rect.width : rect.height,
            props.index,
            props.deltaPx,
            props.snapshotSizes,
            node.orientation === "horizontal" ? this.minWidth : this.minHeight,
          )
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

  updatePane(paneId: PaneId, patch: PaneCommandCapabilityInput): boolean {
    const root = updatePane(this.currentState.root, paneId, (pane) =>
      keepPaneIfUnchanged(pane, withoutUndefined({ ...pane, ...patch })),
    );
    return this.commit({ root });
  }

  setContainerSize(width: number, height: number): boolean {
    if (this.currentState.container.width === width && this.currentState.container.height === height) return false;
    return this.commit({ container: { width, height } });
  }

  private commit(patch: Partial<FocusGridControllerState>): boolean {
    const previous = this.currentState;
    if (
      Object.entries(patch).every(([key, value]) => Object.is(previous[key as keyof FocusGridControllerState], value))
    ) {
      return false;
    }

    const next = { ...previous, ...patch };
    this.currentState = next;
    this.cachedLayout = null;

    for (const listener of this.listeners) {
      listener(next, previous);
    }

    return true;
  }

  subscribePaneEvents({ onPaneLayoutChange, onPaneClose }: PaneEventHandlers): () => void {
    if (!onPaneLayoutChange && !onPaneClose) return () => {};
    return this.subscribe((next, previous) => {
      const previousPanes = new Map(computeLayout(previous).panes.map((pane) => [pane.paneId, pane]));
      const nextPanes = (next === this.currentState ? this.getLayout() : computeLayout(next)).panes;
      for (const pane of nextPanes) {
        const previousPane = previousPanes.get(pane.paneId);
        previousPanes.delete(pane.paneId);
        if (
          previousPane &&
          (pane.rect.x !== previousPane.rect.x ||
            pane.rect.y !== previousPane.rect.y ||
            pane.rect.width !== previousPane.rect.width ||
            pane.rect.height !== previousPane.rect.height)
        ) {
          onPaneLayoutChange?.({ pane, previousPane, controller: this });
        }
      }
      for (const previousPane of previousPanes.values()) {
        onPaneClose?.({ paneId: previousPane.paneId, previousPane, controller: this });
      }
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

function withPaneDefaults(pane: PaneNode, defaults: PaneCommandCapabilityInput): PaneNode {
  return keepPaneIfUnchanged(pane, withoutUndefined({ ...defaults, ...withoutUndefined(pane) }));
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function keepPaneIfUnchanged(pane: PaneNode, next: PaneNode): PaneNode {
  const keys = Object.keys(next) as (keyof PaneNode)[];
  const unchanged = keys.length === Object.keys(pane).length && keys.every((key) => Object.is(pane[key], next[key]));
  return unchanged ? pane : next;
}
