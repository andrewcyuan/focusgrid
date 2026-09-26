import { FocusGridController, type FocusGridControllerProps, type FocusGridControllerState } from "../src";

const observations = new WeakMap<FocusGridController, FocusGridControllerState>();

/** Seed from test input; after a transition, assertions use the emitted state. */
export function createController(props: FocusGridControllerProps): FocusGridController {
  const controller = new FocusGridController(props, { focus: () => true });
  observations.set(controller, { root: props.root, activePaneId: props.activePaneId, container: props.container });
  controller.subscribe(next => observations.set(controller, next));
  return controller;
}

export function observedState(controller: FocusGridController): FocusGridControllerState {
  const state = observations.get(controller);
  if (!state) throw new Error("Controller must be created with createController to observe its changes.");
  return state;
}
