import type { ShortcutBinding } from "./keymap";

export type IndexedBinding = { binding: ShortcutBinding; keys: readonly string[] };
export type SequenceState = {
  pending: readonly string[];
  repeat: { leader: string; expiresAt: number } | null;
};
export type MatchTransition = {
  state: SequenceState;
  status: "ignored" | "pending" | "handled";
  binding?: ShortcutBinding;
};

export function idleSequence(): SequenceState {
  return { pending: [], repeat: null };
}

// Bindings arrive in scope depth and registration priority order.
export function matchSequence(
  bindings: readonly IndexedBinding[],
  sequence: readonly string[],
): { binding?: ShortcutBinding; pending: boolean } {
  let pending = false;
  for (const candidate of bindings) {
    if (!sequence.every((key, index) => key === candidate.keys[index])) continue;
    if (sequence.length === candidate.keys.length) {
      return { binding: candidate.binding, pending: false };
    }
    pending = true;
  }
  return { pending };
}

export function transitionSequence(
  state: SequenceState,
  key: string,
  bindings: readonly IndexedBinding[],
  now: number,
  repeatTimeoutMs: number,
): MatchTransition {
  if (state.repeat && now <= state.repeat.expiresAt) {
    const sequence = [state.repeat.leader, key];
    const match = matchSequence(bindings, sequence);
    if (!match.binding?.repeat) return { state: idleSequence(), status: "handled" };
    return complete(match.binding, sequence, now, repeatTimeoutMs);
  }
  let sequence = [...state.pending, key];
  let match = matchSequence(bindings, sequence);
  if (!match.binding && !match.pending && state.pending.length) {
    sequence = [key];
    match = matchSequence(bindings, sequence);
  }
  if (match.binding) return complete(match.binding, sequence, now, repeatTimeoutMs);
  if (match.pending) {
    return { state: { pending: sequence, repeat: null }, status: "pending" };
  }
  return { state: idleSequence(), status: state.pending.length ? "handled" : "ignored" };
}

function complete(
  binding: ShortcutBinding,
  sequence: readonly string[],
  now: number,
  timeout: number,
): MatchTransition {
  return {
    status: "handled",
    binding,
    state: {
      pending: [],
      repeat: binding.repeat && sequence.length === 2
        ? { leader: sequence[0]!, expiresAt: now + timeout }
        : null,
    },
  };
}
