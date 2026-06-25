import { createContext, useMemo, type ReactNode } from "react";
import type { KeyBinding, Workspace } from "@focusgrid/core";

export type FocusGridContextValue = {
  workspace: Workspace;
  keymap?: KeyBinding[];
};

export const FocusGridContext = createContext<FocusGridContextValue | null>(
  null,
);

export type FocusGridProviderProps = {
  workspace: Workspace;
  keymap?: KeyBinding[];
  children: ReactNode;
};

export function FocusGridProvider({
  workspace,
  keymap,
  children,
}: FocusGridProviderProps) {
  const value = useMemo(
    () => ({
      workspace,
      keymap,
    }),
    [workspace, keymap],
  );

  return (
    <FocusGridContext.Provider value={value}>
      {children}
    </FocusGridContext.Provider>
  );
}
