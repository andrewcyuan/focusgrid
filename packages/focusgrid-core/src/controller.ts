import { CommandRegistry, createDefaultCommandRegistry } from "./commands/registry";
import { createId } from "./utils/ids";
import {
  focusPane,
  removePane,
  resizeHandle as resizeHandleOperation,
  resizePane,
  splitPane,
  swapPanes,
  updatePaneCommandGuards,
  wrapRootInSplit,
  type ResizePaneOptions,
  type SplitPaneOptions,
  type UpdatePaneCommandGuardsOptions,
  type WrapRootInSplitOptions,
} from "./layout/operations";
import { computeLayout } from "./layout/solver";
import type { ComputedLayout, LayoutNode, PaneNode, FocusGridControllerState } from "./state";
import type { NodeId, PaneId } from "./layout/types";
import type { PaneCommandGuardInput } from "./pane-guards";

export type Listener = () => void;

export type PaneDefaults = PaneCommandGuardInput & {
  minWidth?: number;
  minHeight?: number;
};

export type CreateFocusGridControllerOptions = {
  commands?: CommandRegistry;
  paneDefaults?: PaneDefaults;
  directionalFocusOverflow?: boolean;
};

export type FocusGridControllerApi = {
  split(paneId: PaneId, options: SplitPaneOptions): PaneId | null;
  wrapRootInSplit(options: WrapRootInSplitOptions): PaneId | null;
  remove(paneId: PaneId): boolean;
  swap(firstPaneId: PaneId, secondPaneId: PaneId): boolean;
  resize(paneId: PaneId, options: ResizePaneOptions): boolean;
  resizeHandle(splitId: NodeId, options: ResizeHandleOptions): boolean;
  focus(paneId: PaneId): boolean;
  updatePaneCommandGuards(
    paneId: PaneId,
    options: UpdatePaneCommandGuardsOptions,
  ): boolean;
  setContainerSize(width: number, height: number): boolean;
};

export type ResizeHandleOptions = {
  index: number;
  deltaPx: number;
  snapshotSizes?: number[];
};

export class FocusGridController {
  readonly api: FocusGridControllerApi;
  readonly commands: CommandRegistry;
  readonly directionalFocusOverflow: boolean;
  private state: FocusGridControllerState;
  private readonly paneDefaults: PaneDefaults;
  private listeners = new Set<Listener>();

  constructor(initialState: FocusGridControllerState, options: CreateFocusGridControllerOptions = {}) {
    this.paneDefaults = options.paneDefaults ?? {};
    this.directionalFocusOverflow = options.directionalFocusOverflow ?? false;
    this.state = applyPaneDefaultsToState(initialState, this.paneDefaults);
    this.commands = options.commands ?? createDefaultCommandRegistry();
    this.api = {
      split: (paneId, splitOptions) => {
        const newPaneId = splitOptions.newPaneId ?? createId("pane");
        const next = splitPane(this.state, paneId, {
          ...this.paneDefaults,
          ...splitOptions,
          newPaneId,
        });

        return this.commit(next) ? newPaneId : null;
      },
      wrapRootInSplit: (wrapOptions) => {
        const newPaneId = wrapOptions.newPaneId ?? createId("pane");
        const next = wrapRootInSplit(this.state, {
          ...this.paneDefaults,
          ...wrapOptions,
          newPaneId,
        });

        return this.commit(next) ? newPaneId : null;
      },
      remove: (paneId) => this.commit(removePane(this.state, paneId)),
      swap: (firstPaneId, secondPaneId) =>
        this.commit(swapPanes(this.state, firstPaneId, secondPaneId)),
      resize: (paneId, resizeOptions) =>
        this.commit(resizePane(this.state, paneId, resizeOptions)),
      resizeHandle: (splitId, resizeOptions) =>
        this.commit(
          resizeHandleOperation(
            this.state,
            splitId,
            resizeOptions.index,
            resizeOptions.deltaPx,
            resizeOptions.snapshotSizes,
          ),
        ),
      focus: (paneId) => this.commit(focusPane(this.state, paneId)),
      updatePaneCommandGuards: (paneId, guardOptions) =>
        this.commit(updatePaneCommandGuards(this.state, paneId, guardOptions)),
      setContainerSize: (width, height) => {
        if (
          this.state.container.width === width &&
          this.state.container.height === height
        ) {
          return false;
        }

        return this.commit({
          ...this.state,
          container: {
            width,
            height,
          },
        });
      },
    };
  }

  getState(): FocusGridControllerState {
    return this.state;
  }

  getComputedLayout(): ComputedLayout {
    return computeLayout(this.state);
  }

  private commit(next: FocusGridControllerState): boolean {
    if (next === this.state) {
      return false;
    }

    this.state = next;

    for (const listener of this.listeners) {
      listener();
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

export function createFocusGridController(
  initialState: FocusGridControllerState,
  options?: CreateFocusGridControllerOptions,
): FocusGridController {
  return new FocusGridController(initialState, options);
}

function applyPaneDefaultsToState(
  state: FocusGridControllerState,
  paneDefaults: PaneDefaults,
): FocusGridControllerState {
  if (
    paneDefaults.minWidth === undefined &&
    paneDefaults.minHeight === undefined &&
    paneDefaults.noResizeX === undefined &&
    paneDefaults.noResizeY === undefined &&
    paneDefaults.noRemove === undefined &&
    paneDefaults.noSplitHorizontal === undefined &&
    paneDefaults.noSplitVertical === undefined &&
    paneDefaults.noSwapX === undefined &&
    paneDefaults.noSwapY === undefined &&
    paneDefaults.noFocus === undefined
  ) {
    return state;
  }

  const root = applyPaneDefaultsToNode(state.root, paneDefaults);

  return root === state.root
    ? state
    : {
        ...state,
        root,
      };
}

function applyPaneDefaultsToNode(
  node: LayoutNode,
  paneDefaults: PaneDefaults,
): LayoutNode {
  if (node.kind === "pane") {
    return applyPaneDefaultsToPane(node, paneDefaults);
  }

  let changed = false;
  const children = node.children.map((child) => {
    const nextChild = applyPaneDefaultsToNode(child, paneDefaults);
    changed ||= nextChild !== child;
    return nextChild;
  });

  return changed ? { ...node, children } : node;
}

function applyPaneDefaultsToPane(
  pane: PaneNode,
  paneDefaults: PaneDefaults,
): PaneNode {
  const minWidth = pane.minWidth ?? paneDefaults.minWidth;
  const minHeight = pane.minHeight ?? paneDefaults.minHeight;
  const noResizeX = pane.noResizeX ?? paneDefaults.noResizeX;
  const noResizeY = pane.noResizeY ?? paneDefaults.noResizeY;
  const noRemove = pane.noRemove ?? paneDefaults.noRemove;
  const noSplitHorizontal =
    pane.noSplitHorizontal ?? paneDefaults.noSplitHorizontal;
  const noSplitVertical = pane.noSplitVertical ?? paneDefaults.noSplitVertical;
  const noSwapX = pane.noSwapX ?? paneDefaults.noSwapX;
  const noSwapY = pane.noSwapY ?? paneDefaults.noSwapY;
  const noFocus = pane.noFocus ?? paneDefaults.noFocus;

  if (
    minWidth === pane.minWidth &&
    minHeight === pane.minHeight &&
    noResizeX === pane.noResizeX &&
    noResizeY === pane.noResizeY &&
    noRemove === pane.noRemove &&
    noSplitHorizontal === pane.noSplitHorizontal &&
    noSplitVertical === pane.noSplitVertical &&
    noSwapX === pane.noSwapX &&
    noSwapY === pane.noSwapY &&
    noFocus === pane.noFocus
  ) {
    return pane;
  }

  return {
    ...pane,
    minWidth,
    minHeight,
    noResizeX,
    noResizeY,
    noRemove,
    noSplitHorizontal,
    noSplitVertical,
    noSwapX,
    noSwapY,
    noFocus,
  };
}
