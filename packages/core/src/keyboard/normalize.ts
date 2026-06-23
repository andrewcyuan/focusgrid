import type { KeyStroke } from "./keymap";

const MODIFIER_ORDER = ["ctrl", "meta", "alt", "shift"] as const;

export function normalizeKeyName(key: string): string {
  if (key.length === 1) {
    return key.toLowerCase();
  }

  const aliases: Record<string, string> = {
    " ": "space",
    esc: "escape",
    del: "delete",
    return: "enter",
    cmd: "meta",
    command: "meta",
    option: "alt",
  };

  const lowered = key.toLowerCase();
  return aliases[lowered] ?? lowered;
}

export function strokeToId(stroke: KeyStroke): string {
  const modifiers = MODIFIER_ORDER.filter((modifier) => stroke[modifier]);
  return [...modifiers, normalizeKeyName(stroke.key)].join("+");
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
