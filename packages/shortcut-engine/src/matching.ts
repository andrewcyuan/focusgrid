import type { ShortcutBinding } from "./keymap";

export type SequenceState = { pending: string; repeat: { leader: string; expiresAt: number } | null };
export const idleSequence = (): SequenceState => ({ pending: "", repeat: null });

// Bindings are ordered by scope depth, then registration priority.
function match(bindings: readonly ShortcutBinding[], sequence: string) {
  return {
    binding: bindings.find(binding => binding.sequence === sequence),
    pending: bindings.some(binding => binding.sequence.startsWith(`${sequence} `)),
  };
}

export function transitionSequence(
  state: SequenceState,
  key: string,
  bindings: readonly ShortcutBinding[],
  now: number,
  timeout: number,
): { state: SequenceState; status: "ignored" | "pending" | "handled"; binding?: ShortcutBinding } {
  const repeating = state.repeat !== null && now <= state.repeat.expiresAt;
  const prefix = repeating ? state.repeat!.leader : state.pending;
  let sequence = prefix ? `${prefix} ${key}` : key;
  let result = match(bindings, sequence);
  if (repeating && !result.binding?.repeat) return { state: idleSequence(), status: "handled" };
  if (!result.binding && !result.pending && prefix) {
    sequence = key;
    result = match(bindings, sequence);
  }
  if (result.binding) {
    const strokes = sequence.split(" ");
    return {
      status: "handled", binding: result.binding,
      state: { pending: "", repeat: result.binding.repeat && strokes.length === 2
        ? { leader: strokes[0]!, expiresAt: now + timeout } : null },
    };
  }
  return result.pending
    ? { state: { pending: sequence, repeat: null }, status: "pending" }
    : { state: idleSequence(), status: prefix ? "handled" : "ignored" };
}
