import { useRef, useSyncExternalStore } from "react";
import {
  FocusGridController,
  computeLayout,
  type ComputedLayout,
  type FocusGridControllerProps,
  type FocusGridControllerState,
} from "@andrewcyuan/focusgrid/core";

export function useFocusGridController(
  createProps: () => FocusGridControllerProps,
): FocusGridController {
  const controllerRef = useRef<FocusGridController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new FocusGridController(createProps());
  }

  return controllerRef.current;
}

export function useControllerState(
  controller: FocusGridController,
): FocusGridControllerState {
  return useSyncExternalStore(
    controller.subscribe.bind(controller),
    () => controller.state,
    () => controller.state,
  );
}

export function useControllerLayout(
  controller: FocusGridController,
): ComputedLayout {
  return computeLayout(useControllerState(controller));
}
