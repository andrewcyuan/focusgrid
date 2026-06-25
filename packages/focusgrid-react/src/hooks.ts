import { useRef, useSyncExternalStore } from "react";
import {
  createFocusGridController,
  type ComputedLayout,
  type CreateFocusGridControllerOptions,
  type FocusGridController,
  type FocusGridControllerState,
} from "@focusgrid/core";

export function useFocusGridController(
  createInitialState: () => FocusGridControllerState,
  options?: CreateFocusGridControllerOptions,
): FocusGridController {
  const controllerRef = useRef<FocusGridController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createFocusGridController(
      createInitialState(),
      options,
    );
  }

  return controllerRef.current;
}

export function useControllerState(
  controller: FocusGridController,
): FocusGridControllerState {
  return useSyncExternalStore(
    controller.subscribe.bind(controller),
    controller.getState.bind(controller),
    controller.getState.bind(controller),
  );
}

export function useControllerLayout(
  controller: FocusGridController,
): ComputedLayout {
  useControllerState(controller);
  return controller.getComputedLayout();
}
