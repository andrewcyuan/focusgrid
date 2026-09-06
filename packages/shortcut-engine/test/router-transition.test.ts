import { describe, expect, it } from "vitest";
import { parseKeySequence, strokeToId } from "../src";
import { createTrie, transitionKeyRouter } from "../src/trie";

describe("pure key router transition", () => {
  it("returns a new pending state without mutating the previous state", () => {
    const trie = createTrie([
      { sequence: parseKeySequence("Ctrl-B X"), action: "close" },
    ]);
    const previous = { phase: "idle" as const, repeat: null };
    const transition = transitionKeyRouter(
      trie,
      previous,
      strokeToId(parseKeySequence("Ctrl-B")[0]!),
      undefined,
      0,
      500,
    );

    expect(previous).toEqual({ phase: "idle", repeat: null });
    expect(transition.state).not.toBe(previous);
    expect(transition.state.phase).toBe("pending");
    expect(transition.result).toEqual({ matched: false, pending: true });
  });
});
