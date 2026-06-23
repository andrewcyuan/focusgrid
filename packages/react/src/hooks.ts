import { useContext, useSyncExternalStore } from "react";
import type { ComputedLayout, Workspace, WorkspaceState } from "@focusgrid/core";
import { PaneWorkspaceContext } from "./PaneProvider";

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
