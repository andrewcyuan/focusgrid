import { CommandRegistry, createDefaultCommandRegistry } from "./commands/registry";
import { reducer, type WorkspaceAction } from "./layout/reducer";
import { computeLayout } from "./layout/solver";
import type { ComputedLayout, WorkspaceState } from "./state";

export type Listener = () => void;

export type CreateWorkspaceOptions = {
  commands?: CommandRegistry;
};

export class Workspace {
  readonly commands: CommandRegistry;
  private state: WorkspaceState;
  private listeners = new Set<Listener>();

  constructor(initialState: WorkspaceState, options: CreateWorkspaceOptions = {}) {
    this.state = initialState;
    this.commands = options.commands ?? createDefaultCommandRegistry();
  }

  getState(): WorkspaceState {
    return this.state;
  }

  getComputedLayout(): ComputedLayout {
    return computeLayout(this.state);
  }

  dispatch(action: WorkspaceAction): void {
    const next = reducer(this.state, action);

    if (next === this.state) {
      return;
    }

    this.state = next;

    for (const listener of this.listeners) {
      listener();
    }
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
