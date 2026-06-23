import { createKeyStroke } from "./normalize";
import type { KeySequence, KeyStroke } from "./keymap";

export function parseKeySequence(input: string): KeySequence {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseKeyStroke);
}

export function parseKeyStroke(input: string): KeyStroke {
  const parts = input.split("+").filter(Boolean);
  const key = parts.pop();

  if (!key) {
    throw new Error(`Invalid key stroke: ${input}`);
  }

  const stroke = createKeyStroke({ key });

  for (const part of parts) {
    const modifier = part.toLowerCase();

    if (modifier === "ctrl" || modifier === "control") {
      stroke.ctrl = true;
    } else if (modifier === "mod" || modifier === "meta" || modifier === "cmd") {
      stroke.meta = true;
    } else if (modifier === "alt" || modifier === "option") {
      stroke.alt = true;
    } else if (modifier === "shift") {
      stroke.shift = true;
    } else {
      throw new Error(`Unknown key modifier "${part}" in "${input}"`);
    }
  }

  return stroke;
}
