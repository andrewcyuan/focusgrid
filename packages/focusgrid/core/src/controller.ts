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
import type { PaneCommandCapabilityInput } from "./pane-guards";
import { assertValidFocusGridControllerState } from "./validation";

export type Listener = () => void;

export type PaneDefaults = PaneCommandCapabilityInput & {
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
  setPaneData(paneId: PaneId, data: unknown): boolean;
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
    assertValidFocusGridControllerState(initialState);
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
      updatePaneCommandGuards: (paneId, capabilityOptions) =>
        this.commit(
          updatePaneCommandGuards(this.state, paneId, capabilityOptions),
        ),
      setPaneData: (paneId, data) =>
        this.commit(setPaneData(this.state, paneId, data)),
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

  getPaneData<T = unknown>(paneId: PaneId): T | undefined {
    return buildPaneDataIndex(this.state.root).get(paneId) as T | undefined;
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
    paneDefaults.canResizeX === undefined &&
    paneDefaults.canResizeY === undefined &&
    paneDefaults.canRemove === undefined &&
    paneDefaults.canSplitHorizontal === undefined &&
    paneDefaults.canSplitVertical === undefined &&
    paneDefaults.canSwapX === undefined &&
    paneDefaults.canSwapY === undefined &&
    paneDefaults.canFocus === undefined
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
  const canResizeX = pane.canResizeX ?? paneDefaults.canResizeX;
  const canResizeY = pane.canResizeY ?? paneDefaults.canResizeY;
  const canRemove = pane.canRemove ?? paneDefaults.canRemove;
  const canSplitHorizontal =
    pane.canSplitHorizontal ?? paneDefaults.canSplitHorizontal;
  const canSplitVertical = pane.canSplitVertical ?? paneDefaults.canSplitVertical;
  const canSwapX = pane.canSwapX ?? paneDefaults.canSwapX;
  const canSwapY = pane.canSwapY ?? paneDefaults.canSwapY;
  const canFocus = pane.canFocus ?? paneDefaults.canFocus;

  if (
    minWidth === pane.minWidth &&
    minHeight === pane.minHeight &&
    canResizeX === pane.canResizeX &&
    canResizeY === pane.canResizeY &&
    canRemove === pane.canRemove &&
    canSplitHorizontal === pane.canSplitHorizontal &&
    canSplitVertical === pane.canSplitVertical &&
    canSwapX === pane.canSwapX &&
    canSwapY === pane.canSwapY &&
    canFocus === pane.canFocus
  ) {
    return pane;
  }

  return {
    ...pane,
    minWidth,
    minHeight,
    canResizeX,
    canResizeY,
    canRemove,
    canSplitHorizontal,
    canSplitVertical,
    canSwapX,
    canSwapY,
    canFocus,
  };
}

function setPaneData(
  state: FocusGridControllerState,
  paneId: PaneId,
  data: unknown,
): FocusGridControllerState {
  let didUpdate = false;

  const root = setPaneDataInNode(state.root, paneId, data, () => {
    didUpdate = true;
  });

  return didUpdate ? { ...state, root } : state;
}

function setPaneDataInNode(
  node: LayoutNode,
  paneId: PaneId,
  data: unknown,
  markUpdated: () => void,
): LayoutNode {
  if (node.kind === "pane") {
    if (node.paneId !== paneId || Object.is(node.data, data)) {
      return node;
    }

    markUpdated();
    return {
      ...node,
      data,
    };
  }

  let changed = false;
  const children = node.children.map((child) => {
    const nextChild = setPaneDataInNode(child, paneId, data, markUpdated);
    changed ||= nextChild !== child;
    return nextChild;
  });

  return changed ? { ...node, children } : node;
}

function buildPaneDataIndex(root: LayoutNode): Map<PaneId, unknown> {
  const out = new Map<PaneId, unknown>();
  visit(root);
  return out;

  function visit(node: LayoutNode): void {
    if (node.kind === "pane") {
      out.set(node.paneId, node.data);
      return;
    }

    for (const child of node.children) {
      visit(child);
    }
  }
}
