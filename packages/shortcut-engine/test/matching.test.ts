import { expect, it } from "vitest";
import { parseKeySequence, strokeToId } from "../src";
import { idleSequence, transitionSequence } from "../src/matching";

it("computes a sequence transition without mutating its input", () => {
  const sequence = parseKeySequence("Ctrl-B X");
  const state = idleSequence();
  const result = transitionSequence(state, strokeToId(sequence[0]!), [
    { keys: sequence.map(strokeToId), binding: { sequence, action: () => {} } },
  ], 0, 500);
  expect(state).toEqual(idleSequence());
  expect(result.status).toBe("pending");
  expect(result.state.pending).toEqual([strokeToId(sequence[0]!)]);
});
