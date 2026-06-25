import { useContext, useRef, useSyncExternalStore } from "react";
import {
  createWorkspace,
  type ComputedLayout,
  type CreateWorkspaceOptions,
  type Workspace,
  type WorkspaceState,
} from "@focusgrid/core";
import { PaneWorkspaceContext } from "./PaneProvider";

export function usePaneWorkspace(
  createInitialState: () => WorkspaceState,
  options?: CreateWorkspaceOptions,
): Workspace {
  const workspaceRef = useRef<Workspace | null>(null);

  if (!workspaceRef.current) {
    workspaceRef.current = createWorkspace(createInitialState(), options);
  }

  return workspaceRef.current;
}

export function useWorkspace(): Workspace {
  const workspace = useContext(PaneWorkspaceContext);

  if (!workspace) {
    throw new Error("useWorkspace must be used inside <PaneProvider>");
  }

  return workspace;
}

export function useWorkspaceState(): WorkspaceState {
  const workspace = useWorkspace();

  return useSyncExternalStore(
    workspace.subscribe.bind(workspace),
    workspace.getState.bind(workspace),
    workspace.getState.bind(workspace),
  );
}

export function useComputedLayout(): ComputedLayout {
  const workspace = useWorkspace();
  useWorkspaceState();
  return workspace.getComputedLayout();
}
