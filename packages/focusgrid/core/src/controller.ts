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
import type {
  ComputedLayout,
  PaneNode,
  FocusGridControllerState,
} from "./layout/types";
import { paneCommandCapabilityKeys, type NodeId, type PaneId } from "./layout/types";
import type { PaneCommandCapabilityInput } from "./layout/types";
import { findPaneNode, transformLayout, updatePane } from "./layout/tree";
import { assertValidFocusGridControllerState } from "./validation";
import { applyPaneCapabilityDefaults } from "./pane-guards";

export type Listener = (
  nextState: FocusGridControllerState,
  previousState: FocusGridControllerState,
) => void;

export type PaneDefaults = PaneCommandCapabilityInput & {
  minWidth?: number;
  minHeight?: number;
};

export type CreateFocusGridControllerOptions = {
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
    this.commands = createDefaultCommandRegistry();
    this.api = {
      split: (paneId, splitOptions) => {
        const newPaneId = splitOptions.newPaneId ?? createId("pane");
        const next = splitPane(this.state, paneId, {
          ...this.paneDefaults,
          ...splitOptions,
          newPaneId,
          newPaneNodeId: createId("node"),
          splitId: createId("split"),
        });

        return this.commit(next) ? newPaneId : null;
      },
      wrapRootInSplit: (wrapOptions) => {
        const newPaneId = wrapOptions.newPaneId ?? createId("pane");
        const next = wrapRootInSplit(this.state, {
          ...this.paneDefaults,
          ...wrapOptions,
          newPaneId,
          newPaneNodeId: createId("node"),
          splitId: createId("split"),
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
    const pane = findPaneNode(this.state.root, paneId);
    return pane?.data as T | undefined;
  }

  private commit(next: FocusGridControllerState): boolean {
    if (next === this.state) {
      return false;
    }

    const previous = this.state;
    this.state = next;

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
    paneCommandCapabilityKeys.every((key) => paneDefaults[key] === undefined)
  ) {
    return state;
  }

  const root = transformLayout(state.root, (node) =>
    node.kind === "pane" ? applyPaneDefaultsToPane(node, paneDefaults) : node,
  );

  return root === state.root
    ? state
    : {
        ...state,
        root,
      };
}

function applyPaneDefaultsToPane(
  pane: PaneNode,
  paneDefaults: PaneDefaults,
): PaneNode {
  const minWidth = pane.minWidth ?? paneDefaults.minWidth;
  const minHeight = pane.minHeight ?? paneDefaults.minHeight;
  const paneWithCapabilities = applyPaneCapabilityDefaults(pane, paneDefaults);

  if (
    minWidth === pane.minWidth &&
    minHeight === pane.minHeight &&
    paneWithCapabilities === pane
  ) {
    return pane;
  }

  return {
    ...paneWithCapabilities,
    minWidth,
    minHeight,
  };
}

function setPaneData(
  state: FocusGridControllerState,
  paneId: PaneId,
  data: unknown,
): FocusGridControllerState {
  const root = updatePane(state.root, paneId, (pane) =>
    Object.is(pane.data, data) ? pane : { ...pane, data },
  );
  return root === state.root ? state : { ...state, root };
}
