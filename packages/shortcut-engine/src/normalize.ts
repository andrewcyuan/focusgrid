import type { KeyStroke } from "./keymap";

const MODIFIER_ORDER = ["ctrl", "meta", "alt", "shift"] as const;

export function normalizeKeyName(key: string): string {
  const aliases: Record<string, string> = {
    " ": "space",
    esc: "escape",
    del: "delete",
    return: "enter",
    cmd: "meta",
    command: "meta",
    option: "alt",
    arrowdown: "down",
    "arrow-down": "down",
    arrowleft: "left",
    "arrow-left": "left",
    arrowright: "right",
    "arrow-right": "right",
    arrowup: "up",
    "arrow-up": "up",
  };

  const lowered = key.toLowerCase();

  if (aliases[lowered]) {
    return aliases[lowered];
  }

  if (key.length === 1) {
    return lowered;
  }

  return lowered;
}

export function strokeToId(stroke: KeyStroke): string {
  const modifiers = MODIFIER_ORDER.filter((modifier) => stroke[modifier]);
  return [...modifiers, normalizeKeyName(stroke.key)].join("-");
}

export function createKeyStroke(input: Partial<KeyStroke> & { key: string }): KeyStroke {
  return {
    key: normalizeKeyName(input.key),
    ctrl: input.ctrl ?? false,
    meta: input.meta ?? false,
    alt: input.alt ?? false,
    shift: input.shift ?? false,
  };
}
