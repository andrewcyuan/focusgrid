import { CommandRegistry, createDefaultCommandRegistry } from "./commands/registry";
import { createId } from "./utils/ids";
import { reducer, type WorkspaceAction } from "./layout/reducer";
import {
  focusPane,
  removePane,
  resizePane,
  splitPane,
  swapPanes,
  wrapRootInSplit,
  type ResizePaneOptions,
  type SplitPaneOptions,
  type WrapRootInSplitOptions,
} from "./layout/operations";
import { computeLayout } from "./layout/solver";
import type { ComputedLayout, WorkspaceState } from "./state";
import type { PaneId } from "./layout/types";

export type Listener = () => void;

export type CreateWorkspaceOptions = {
  commands?: CommandRegistry;
};

export type WorkspaceApi = {
  split(paneId: PaneId, options: SplitPaneOptions): PaneId | null;
  wrapRootInSplit(options: WrapRootInSplitOptions): PaneId | null;
  remove(paneId: PaneId): boolean;
  swap(firstPaneId: PaneId, secondPaneId: PaneId): boolean;
  resize(paneId: PaneId, options: ResizePaneOptions): boolean;
  focus(paneId: PaneId): boolean;
};

export class Workspace {
  readonly api: WorkspaceApi;
  readonly commands: CommandRegistry;
  private state: WorkspaceState;
  private listeners = new Set<Listener>();

  constructor(initialState: WorkspaceState, options: CreateWorkspaceOptions = {}) {
    this.state = initialState;
    this.commands = options.commands ?? createDefaultCommandRegistry();
    this.api = {
      split: (paneId, splitOptions) => {
        const newPaneId = splitOptions.newPaneId ?? createId("pane");
        const next = splitPane(this.state, paneId, {
          ...splitOptions,
          newPaneId,
        });

        return this.commit(next) ? newPaneId : null;
      },
      wrapRootInSplit: (wrapOptions) => {
        const newPaneId = wrapOptions.newPaneId ?? createId("pane");
        const next = wrapRootInSplit(this.state, {
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
      focus: (paneId) => this.commit(focusPane(this.state, paneId)),
    };
  }

  getState(): WorkspaceState {
    return this.state;
  }

  getComputedLayout(): ComputedLayout {
    return computeLayout(this.state);
  }

  dispatch(action: WorkspaceAction): void {
    const next = reducer(this.state, action);

    this.commit(next);
  }

  private commit(next: WorkspaceState): boolean {
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

export function createWorkspace(
  initialState: WorkspaceState,
  options?: CreateWorkspaceOptions,
): Workspace {
  return new Workspace(initialState, options);
}
