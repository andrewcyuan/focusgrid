import { useCallback, useState, useSyncExternalStore } from "react";
import { FocusGridController, type ComputedLayout, type FocusGridControllerProps } from "@andrewcyuan/focusgrid/core";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import type { FocusGridControllers } from "./FocusgridController";

export function useFocusGridController(createProps: () => FocusGridControllerProps): FocusGridControllers {
  const [controllers] = useState(() => {
    const domController = new FocusGridDomController();
    return { controller: new FocusGridController(createProps(), domController), domController };
  });
  return controllers;
}

export function useControllerLayout(controller: FocusGridController): ComputedLayout {
  const subscribe = useCallback((notify: () => void) => controller.subscribe(notify), [controller]);
  const getLayout = useCallback(() => controller.getLayout(), [controller]);
  return useSyncExternalStore(subscribe, getLayout, getLayout);
}
