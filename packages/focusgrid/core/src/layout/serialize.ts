import type { FocusGridControllerState } from "./types";
import {
  assertValidFocusGridControllerState,
  FocusGridStateValidationException,
} from "../validation";

export function deserializeFocusGridControllerState(
  serialized: string,
): FocusGridControllerState {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new FocusGridStateValidationException([{
      code: "invalid-json", path: "$",
      message: error instanceof Error ? error.message : "Serialized state must be valid JSON.",
    }]);
  }

  assertValidFocusGridControllerState(parsed);
  return parsed;
}
