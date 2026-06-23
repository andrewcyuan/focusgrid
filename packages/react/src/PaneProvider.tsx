import { createContext, type ReactNode } from "react";
import type { Workspace } from "@focusgrid/core";

export const PaneWorkspaceContext = createContext<Workspace | null>(null);

export type PaneProviderProps = {
  workspace: Workspace;
  children: ReactNode;
};

export function PaneProvider({ workspace, children }: PaneProviderProps) {
  return (
    <PaneWorkspaceContext.Provider value={workspace}>
      {children}
    </PaneWorkspaceContext.Provider>
  );
}
