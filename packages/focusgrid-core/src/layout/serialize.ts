import type { FocusGridControllerState } from "./types";

export function serializeFocusGridControllerState(
  state: FocusGridControllerState,
): string {
  return JSON.stringify(state);
}

export function deserializeFocusGridControllerState(
  serialized: string,
): FocusGridControllerState {
  return JSON.parse(serialized) as FocusGridControllerState;
}
