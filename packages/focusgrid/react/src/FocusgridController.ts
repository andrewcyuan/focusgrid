import { createContext, useContext } from "react";
import type { FocusGridController } from "@andrewcyuan/focusgrid/core";
import type { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";

export type FocusGridControllers = {
  controller: FocusGridController;
  domController: FocusGridDomController;
};

export const FocusgridController = createContext<FocusGridControllers | null>(null);

export function useGridControllers(): FocusGridControllers {
  const controllers = useContext(FocusgridController);
  if (!controllers) throw new Error("FocusGrid requires a FocusgridController provider");
  return controllers;
}
