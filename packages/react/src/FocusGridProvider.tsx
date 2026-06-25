import { createContext, type ReactNode } from "react";
import type { Workspace } from "@focusgrid/core";

export const FocusGridWorkspaceContext = createContext<Workspace | null>(null);

export type FocusGridProviderProps = {
  workspace: Workspace;
  children: ReactNode;
};

export function FocusGridProvider({ workspace, children }: FocusGridProviderProps) {
  return (
    <FocusGridWorkspaceContext.Provider value={workspace}>
      {children}
    </FocusGridWorkspaceContext.Provider>
  );
}
