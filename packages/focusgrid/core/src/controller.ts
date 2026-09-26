import { createId } from "./utils/ids";
import {
  focusPane,
  removePane,
  resizeHandle as resizeHandleOperation,
  resizePane,
  splitPane,
  swapPanes,
  type ResizePaneOptions,
  type SplitPaneOptions,
} from "./layout/operations";
import type {
  PaneNode,
  FocusGridControllerState,
} from "./layout/types";
import { paneCommandCapabilityKeys, type NodeId, type PaneId } from "./layout/types";
import type { PaneCommandCapabilityInput } from "./layout/types";
import { buildLayoutIndex, transformLayout, updatePane } from "./layout/tree";
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

export type FocusGridControllerProps = FocusGridControllerState & {
  paneDefaults?: PaneDefaults;
  directionalFocusOverflow?: boolean;
};

export type ResizeHandleOptions = {
  index: number;
  deltaPx: number;
  snapshotSizes?: number[];
};

export class FocusGridController {
  readonly directionalFocusOverflow: boolean;
  private currentState: FocusGridControllerState;
  private readonly paneDefaults: PaneDefaults;
  private listeners = new Set<Listener>();

  constructor({
    paneDefaults = {},
    directionalFocusOverflow = false,
    ...state
  }: FocusGridControllerProps) {
    assertValidFocusGridControllerState(state);
    this.paneDefaults = paneDefaults;
    this.directionalFocusOverflow = directionalFocusOverflow;
    this.currentState = applyPaneDefaultsToState(state, paneDefaults);
  }

  split(paneNodeId: NodeId, props: SplitPaneOptions): PaneId | null {
    const pane = buildLayoutIndex(this.currentState.root).nodeById.get(paneNodeId);
    if (pane?.kind !== "pane") return null;
    const newPaneId = props.newPaneId ?? createId("pane");
    const next = splitPane(this.currentState, paneNodeId, {
      ...this.paneDefaults,
      ...props,
      newPaneId,
      newPaneNodeId: props.newPaneNodeId ?? createId("node"),
      splitId: props.splitId ?? createId("split"),
    });
    return this.commit(next) ? newPaneId : null;
  }

  remove(paneId: PaneId): boolean {
    return this.commit(removePane(this.currentState, paneId));
  }

  swap(firstPaneId: PaneId, secondPaneId: PaneId): boolean {
    return this.commit(swapPanes(this.currentState, firstPaneId, secondPaneId));
  }

  resize(paneId: PaneId, props: ResizePaneOptions): boolean {
    return this.commit(resizePane(this.currentState, paneId, props));
  }

  resizeHandle(splitId: NodeId, props: ResizeHandleOptions): boolean {
    return this.commit(
      resizeHandleOperation(this.currentState, splitId, props.index, props.deltaPx, props.snapshotSizes),
    );
  }

  focus(paneId: PaneId): boolean {
    return this.commit(focusPane(this.currentState, paneId));
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
    return this.commit(root === this.currentState.root ? this.currentState : { ...this.currentState, root });
  }

  setContainerSize(width: number, height: number): boolean {
    if (this.currentState.container.width === width && this.currentState.container.height === height) return false;
    return this.commit({ ...this.currentState, container: { width, height } });
  }

  get state(): FocusGridControllerState {
    return this.currentState;
  }

  private commit(next: FocusGridControllerState): boolean {
    if (next === this.currentState) {
      return false;
    }

    const previous = this.currentState;
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
    ...(minWidth === undefined ? {} : { minWidth }),
    ...(minHeight === undefined ? {} : { minHeight }),
  };
}
