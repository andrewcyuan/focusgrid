import { computeLayoutGeometry } from "./geometry";
import type { ComputedLayout, FocusGridControllerState } from "./types";

export function computeLayout(state: FocusGridControllerState): ComputedLayout {
  const { panes, handles } = computeLayoutGeometry(state);
  return { panes, handles };
}
