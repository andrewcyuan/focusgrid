import { describe, expect, it, vi } from "vitest";
import {
  KeyRouter,
  createKeyStroke,
  isModifierOnlyKey,
  normalizeKeyName,
  normalizeKeySequenceInput,
  normalizeKeyboardEvent,
  parseKeySequence,
  routeKeyboardEvent,
  strokeToId,
  validateKeySequenceInput,
} from "../src";

function keyboardEvent(input: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: input.key ?? "",
    ctrlKey: input.ctrlKey ?? false,
    metaKey: input.metaKey ?? false,
    altKey: input.altKey ?? false,
    shiftKey: input.shiftKey ?? false,
  } as KeyboardEvent;
}

function routableKeyboardEvent(input: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: input.key ?? "",
    ctrlKey: input.ctrlKey ?? false,
    metaKey: input.metaKey ?? false,
    altKey: input.altKey ?? false,
    shiftKey: input.shiftKey ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe("key normalization", () => {
  it("normalizes key names and aliases", () => {
    expect(normalizeKeyName("B")).toBe("b");
    expect(normalizeKeyName("Esc")).toBe("escape");
    expect(normalizeKeyName("Arrow-Left")).toBe("left");
    expect(normalizeKeyName("ArrowRight")).toBe("right");
    expect(normalizeKeyName(" ")).toBe("space");
    expect(strokeToId(createKeyStroke({ key: "ArrowRight", ctrl: true }))).toBe(
      "ctrl-right",
    );
  });

  it("uses dashes for modifier key syntax and normalizes arrow aliases", () => {
    expect(
      parseKeySequence("Ctrl-Shift-B Arrow-Left ArrowRight Ctrl-+ -"),
    ).toEqual([
      {
        key: "b",
        ctrl: true,
        meta: false,
        alt: false,
        shift: true,
      },
      {
        key: "left",
        ctrl: false,
        meta: false,
        alt: false,
        shift: false,
      },
      {
        key: "right",
        ctrl: false,
        meta: false,
        alt: false,
        shift: false,
      },
      {
        key: "+",
        ctrl: true,
        meta: false,
        alt: false,
        shift: false,
      },
      {
        key: "-",
        ctrl: false,
        meta: false,
        alt: false,
        shift: false,
      },
    ]);

    expect(() => parseKeySequence("Ctrl+B")).toThrow(
      "Invalid key stroke: Ctrl+B",
    );
  });

  it("normalizes and validates plus-style input for editors", () => {
    expect(normalizeKeySequenceInput("  Ctrl+B   Shift+Left  ")).toBe(
      "Ctrl-B Shift-Left",
    );

    expect(validateKeySequenceInput("Ctrl+B")).toEqual({
      ok: true,
      sequence: parseKeySequence("Ctrl-B"),
      value: "Ctrl-B",
    });

    expect(validateKeySequenceInput("Ctrl+")).toEqual({
      ok: false,
      error: "Invalid key stroke: Ctrl+",
    });
  });
});

describe("DOM keyboard event normalization", () => {
  it("keeps shift for alphabetic keys", () => {
    expect(
      normalizeKeyboardEvent(
        keyboardEvent({
          key: "B",
          shiftKey: true,
        }),
      ),
    ).toEqual({
      key: "b",
      ctrl: false,
      meta: false,
      alt: false,
      shift: true,
    });
  });

  it("drops shift for symbols already produced by shift", () => {
    expect(
      normalizeKeyboardEvent(
        keyboardEvent({
          key: "%",
          ctrlKey: true,
          shiftKey: true,
        }),
      ),
    ).toEqual({
      key: "%",
      ctrl: true,
      meta: false,
      alt: false,
      shift: false,
    });
  });

  it("converts shifted printable base keys to their produced symbol", () => {
    expect(
      normalizeKeyboardEvent(
        keyboardEvent({
          key: "5",
          ctrlKey: true,
          shiftKey: true,
        }),
      ),
    ).toEqual({
      key: "%",
      ctrl: true,
      meta: false,
      alt: false,
      shift: false,
    });
  });

  it("filters modifier-only keydown events", () => {
    expect(isModifierOnlyKey("Shift")).toBe(true);
    expect(isModifierOnlyKey("Control")).toBe(true);
    expect(isModifierOnlyKey("AltGraph")).toBe(true);
    expect(isModifierOnlyKey("B")).toBe(false);
  });
});

describe("routeKeyboardEvent", () => {
  const ctx = {
    active: true,
  };

  it("ignores modifier-only events without routing or preventing", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Shift-X"),
        action: "active.run",
      },
    ]);
    const handle = vi.spyOn(router, "handle");
    const event = routableKeyboardEvent({ key: "Shift", shiftKey: true });

    expect(routeKeyboardEvent(event, router, { context: ctx })).toBeNull();
    expect(handle).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  it("respects ignored events without routing or preventing", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("X"),
        action: "active.run",
      },
    ]);
    const handle = vi.spyOn(router, "handle");
    const event = routableKeyboardEvent({ key: "x" });

    expect(
      routeKeyboardEvent(event, router, {
        context: ctx,
        ignoreEvent: () => true,
      }),
    ).toBeNull();
    expect(handle).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  it("routes normalized browser events and calls onMatch", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-%"),
        action: "active.run",
        args: { source: "keyboard" },
      },
    ]);
    const onMatch = vi.fn();
    const event = routableKeyboardEvent({
      key: "5",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(routeKeyboardEvent(event, router, { context: ctx, onMatch })).toEqual(
      {
        matched: true,
        pending: false,
        action: "active.run",
        args: { source: "keyboard" },
        preventDefault: true,
      },
    );
    expect(onMatch).toHaveBeenCalledWith(
      expect.objectContaining({ action: "active.run" }),
      event,
    );
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("prevents pending prefixes and invalid continuations", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-B X"),
        action: "active.run",
      },
    ]);
    const prefix = routableKeyboardEvent({ key: "b", ctrlKey: true });
    const invalid = routableKeyboardEvent({ key: "z" });

    expect(routeKeyboardEvent(prefix, router, { context: ctx })).toEqual({
      matched: false,
      pending: true,
    });
    expect(prefix.preventDefault).toHaveBeenCalledTimes(1);
    expect(prefix.stopPropagation).toHaveBeenCalledTimes(1);

    expect(routeKeyboardEvent(invalid, router, { context: ctx })).toEqual({
      matched: false,
      pending: false,
      preventDefault: true,
    });
    expect(invalid.preventDefault).toHaveBeenCalledTimes(1);
    expect(invalid.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("honors preventDefault false on matched shortcuts", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("X"),
        action: "active.run",
        preventDefault: false,
      },
    ]);
    const onMatch = vi.fn();
    const event = routableKeyboardEvent({ key: "x" });

    expect(routeKeyboardEvent(event, router, { context: ctx, onMatch })).toEqual(
      {
        matched: true,
        pending: false,
        action: "active.run",
        args: undefined,
        preventDefault: false,
      },
    );
    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });
});

describe("KeyRouter", () => {
  const ctx = {
    active: true,
  };

  it("matches multi-stroke shortcuts through the trie", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-B %"),
        action: "pane.splitRight",
      },
    ]);

    expect(router.handle(parseKeySequence("Ctrl-B")[0]!, ctx)).toEqual({
      matched: false,
      pending: true,
    });

    expect(router.handle(parseKeySequence("%")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      action: "pane.splitRight",
      args: undefined,
      preventDefault: true,
    });
  });

  it("consumes an invalid continuation after a pending shortcut prefix", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-B %"),
        action: "pane.splitRight",
      },
    ]);

    router.handle(parseKeySequence("Ctrl-B")[0]!, ctx);

    expect(router.handle(parseKeySequence("Z")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: true,
    });

    expect(router.handle(parseKeySequence("Z")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: false,
    });
  });

  it("uses generic when predicates before matching actions", () => {
    const router = new KeyRouter<typeof ctx>([
      {
        sequence: parseKeySequence("X"),
        action: "active.run",
        when: (value) => value.active,
      },
      {
        sequence: parseKeySequence("Y"),
        action: "inactive.run",
        when: (value) => !value.active,
      },
    ]);

    expect(router.handle(parseKeySequence("X")[0]!, ctx)).toMatchObject({
      matched: true,
      action: "active.run",
    });
    expect(router.handle(parseKeySequence("Y")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
    });
  });

  it("does not leave a disabled single-stroke binding pending", () => {
    const router = new KeyRouter<typeof ctx>([
      {
        sequence: parseKeySequence("X"),
        action: "inactive.run",
        when: (value) => !value.active,
      },
      {
        sequence: parseKeySequence("X Y"),
        action: "active.run",
      },
    ]);

    expect(router.handle(parseKeySequence("X")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
    });

    expect(router.handle(parseKeySequence("Y")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: false,
    });
  });

  it("resets cleanly when a multi-stroke completion is disabled", () => {
    const router = new KeyRouter<typeof ctx>([
      {
        sequence: parseKeySequence("Ctrl-B X"),
        action: "inactive.run",
        when: (value) => !value.active,
      },
      {
        sequence: parseKeySequence("Y"),
        action: "active.run",
      },
    ]);

    expect(router.handle(parseKeySequence("Ctrl-B")[0]!, ctx)).toEqual({
      matched: false,
      pending: true,
    });

    expect(router.handle(parseKeySequence("X")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
    });

    expect(router.handle(parseKeySequence("Y")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      action: "active.run",
      args: undefined,
      preventDefault: true,
    });
  });

  it("retains a repeatable leader so different followers can run during the repeat window", () => {
    let now = 1000;
    const router = new KeyRouter(
      [
        {
          sequence: parseKeySequence("Ctrl-B L"),
          action: "pane.resizeRight",
          args: { deltaPx: 4 },
          repeat: true,
        },
        {
          sequence: parseKeySequence("Ctrl-B H"),
          action: "pane.resizeLeft",
          args: { deltaPx: 4 },
          repeat: true,
        },
      ],
      {
        repeatTimeoutMs: 300,
        now: () => now,
      },
    );

    router.handle(parseKeySequence("Ctrl-B")[0]!, ctx);

    expect(router.handle(parseKeySequence("L")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      action: "pane.resizeRight",
      args: { deltaPx: 4 },
      preventDefault: true,
    });

    now += 250;

    expect(router.handle(parseKeySequence("H")[0]!, ctx)).toEqual({
      matched: true,
      pending: false,
      action: "pane.resizeLeft",
      args: { deltaPx: 4 },
      preventDefault: true,
    });
  });

  it("does not run a different follower after the repeat window expires", () => {
    let now = 1000;
    const router = new KeyRouter(
      [
        {
          sequence: parseKeySequence("Ctrl-B L"),
          action: "pane.resizeRight",
          repeat: true,
        },
        {
          sequence: parseKeySequence("Ctrl-B H"),
          action: "pane.resizeLeft",
          repeat: true,
        },
      ],
      {
        repeatTimeoutMs: 300,
        now: () => now,
      },
    );

    router.handle(parseKeySequence("Ctrl-B")[0]!, ctx);
    router.handle(parseKeySequence("L")[0]!, ctx);

    now += 301;

    expect(router.handle(parseKeySequence("H")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: false,
    });
  });

  it("does not run non-repeatable bindings from a retained leader", () => {
    const router = new KeyRouter([
      {
        sequence: parseKeySequence("Ctrl-B L"),
        action: "pane.resizeRight",
        repeat: true,
      },
      {
        sequence: parseKeySequence("Ctrl-B X"),
        action: "pane.close",
      },
    ]);

    router.handle(parseKeySequence("Ctrl-B")[0]!, ctx);
    router.handle(parseKeySequence("L")[0]!, ctx);

    expect(router.handle(parseKeySequence("X")[0]!, ctx)).toEqual({
      matched: false,
      pending: false,
      preventDefault: true,
    });
  });
});
