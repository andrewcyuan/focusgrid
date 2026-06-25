import type { WorkspaceState } from "./types";

export function serializeWorkspace(state: WorkspaceState): string {
  return JSON.stringify(state);
}

export function deserializeWorkspace(serialized: string): WorkspaceState {
  return JSON.parse(serialized) as WorkspaceState;
}
