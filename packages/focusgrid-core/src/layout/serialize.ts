import type { FocusGridControllerState } from "./types";
import {
  assertValidFocusGridControllerState,
  createInvalidJsonStateValidationException,
} from "../validation";

export function serializeFocusGridControllerState(
  state: FocusGridControllerState,
): string {
  return JSON.stringify(state);
}

export function deserializeFocusGridControllerState(
  serialized: string,
): FocusGridControllerState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw createInvalidJsonStateValidationException(
      error instanceof Error ? error.message : "Serialized state must be valid JSON.",
    );
  }

  assertValidFocusGridControllerState(parsed);
  return parsed;
}
