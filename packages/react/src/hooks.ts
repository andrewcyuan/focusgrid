import { useContext, useRef, useSyncExternalStore } from "react";
import {
  createWorkspace,
  type ComputedLayout,
  type CreateWorkspaceOptions,
  type KeyBinding,
  type Workspace,
  type WorkspaceState,
} from "@focusgrid/core";
import { FocusGridContext } from "./FocusGridProvider";

export function useFocusGridWorkspace(
  createInitialState: () => WorkspaceState,
  options?: CreateWorkspaceOptions,
): Workspace {
  const workspaceRef = useRef<Workspace | null>(null);

  if (!workspaceRef.current) {
    workspaceRef.current = createWorkspace(createInitialState(), options);
  }

  return workspaceRef.current;
}

export function useFocusGridKeymap(): KeyBinding[] | undefined {
  return useFocusGridContext().keymap;
}

export function useWorkspace(): Workspace {
  return useFocusGridContext().workspace;
}

function useFocusGridContext() {
  const context = useContext(FocusGridContext);

  if (!context) {
    throw new Error("FocusGrid hooks must be used inside <FocusGridProvider>");
  }

  return context;
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
