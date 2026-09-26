import { useCallback, useState, useSyncExternalStore } from "react";
import {
  FocusGridController,
  type DomController,
  type ComputedLayout,
  type FocusGridControllerProps,
} from "@andrewcyuan/focusgrid/core";

export function useFocusGridController(
  createProps: () => FocusGridControllerProps,
  domController: DomController,
): FocusGridController {
  const [controller] = useState(() => new FocusGridController(createProps(), domController));
  return controller;
}

export function useControllerLayout(controller: FocusGridController): ComputedLayout {
  const subscribe = useCallback((notify: () => void) => controller.subscribe(notify), [controller]);
  const getLayout = useCallback(() => controller.getLayout(), [controller]);
  return useSyncExternalStore(subscribe, getLayout, getLayout);
}
