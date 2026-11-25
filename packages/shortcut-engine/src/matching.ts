export type ShortcutBinding = {
  sequence: string;
  action: (event: KeyboardEvent) => void;
  when?: (event: KeyboardEvent) => boolean;
  preventDefault?: boolean;
  repeat?: boolean;
};
export type ShortcutStatus = "ignored" | "pending" | "handled";
type SequenceState = { pending: string; repeat: { leader: string; expiresAt: number } | null };

const REPEAT_TIMEOUT_MS = 500;
export const idleSequence = (): SequenceState => ({ pending: "", repeat: null });

// Bindings are ordered by scope depth, then registration priority.
function match(bindings: readonly ShortcutBinding[], sequence: string) {
  return {
    binding: bindings.find((binding) => binding.sequence === sequence),
    pending: bindings.some((binding) => binding.sequence.startsWith(`${sequence} `)),
  };
}

export function transitionSequence(
  state: SequenceState,
  key: string,
  bindings: readonly ShortcutBinding[],
): { state: SequenceState; status: ShortcutStatus; binding?: ShortcutBinding } {
  const now = Date.now();
  const repeating = state.repeat !== null && now <= state.repeat.expiresAt;
  const prefix = repeating ? state.repeat!.leader : state.pending;
  let sequence = prefix ? `${prefix} ${key}` : key;
  let result = match(bindings, sequence);
  if ((repeating && !result.binding?.repeat) || (!result.binding && !result.pending && prefix)) {
    sequence = key;
    result = match(bindings, sequence);
  }
  if (result.binding) {
    const strokes = sequence.split(" ");
    return {
      status: "handled",
      binding: result.binding,
      state: {
        pending: "",
        repeat:
          result.binding.repeat && strokes.length === 2
            ? { leader: strokes[0]!, expiresAt: now + REPEAT_TIMEOUT_MS }
            : null,
      },
    };
  }
  return result.pending
    ? { state: { pending: sequence, repeat: null }, status: "pending" }
    : { state: idleSequence(), status: prefix ? "handled" : "ignored" };
}
