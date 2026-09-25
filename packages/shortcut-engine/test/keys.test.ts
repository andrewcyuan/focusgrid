import { describe, expect, it } from "vitest";
import {
  createKeyStroke,
  isModifierOnlyKey,
  isEditableTarget,
  normalizeKeyName,
  normalizeKeySequenceInput,
  normalizeKeyboardEvent,
  parseKeySequence,
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

describe("editable target classification", () => {
  const cases: Array<[string, object, boolean]> = [
    ["textarea", { tagName: "TEXTAREA" }, true],
    ["disabled textarea", { tagName: "TEXTAREA", disabled: true }, false],
    ["text input", { tagName: "INPUT", type: "text" }, true],
    ["readonly input", { tagName: "INPUT", type: "text", readOnly: true }, false],
    ["checkbox", { tagName: "INPUT", type: "checkbox" }, false],
    ["contenteditable", { tagName: "DIV", isContentEditable: true }, true],
    [
      "textbox role",
      { tagName: "DIV", getAttribute: (name: string) => name === "role" ? "TEXTBOX" : null },
      true,
    ],
  ];

  it.each(cases)("classifies %s", (_, target, expected) => {
    expect(isEditableTarget(target as EventTarget)).toBe(expected);
  });
});

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
