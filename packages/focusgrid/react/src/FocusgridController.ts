import { createContext, useContext } from "react";
import type { FocusGridController } from "@andrewcyuan/focusgrid/core";
import type { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";

export const FocusgridController = createContext<{
  controller: FocusGridController;
  domController: FocusGridDomController;
} | null>(null);

export function useGridControllers() {
  const controllers = useContext(FocusgridController);
  if (!controllers) throw new Error("FocusGrid requires a FocusgridController provider");
  return controllers;
}
