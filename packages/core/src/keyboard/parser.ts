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
  const parts = splitKeyStroke(input);
  const key = parts.key;

  if (!key || (input.includes("+") && key !== "+")) {
    throw new Error(`Invalid key stroke: ${input}`);
  }

  const stroke = createKeyStroke({ key });

  for (const part of parts.modifiers) {
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

function splitKeyStroke(input: string): { modifiers: string[]; key: string } {
  let rest = input;
  const modifiers: string[] = [];

  while (true) {
    const separatorIndex = rest.indexOf("-");

    if (separatorIndex <= 0) {
      return {
        modifiers,
        key: rest,
      };
    }

    const part = rest.slice(0, separatorIndex);

    if (!isModifierName(part)) {
      return {
        modifiers,
        key: rest,
      };
    }

    modifiers.push(part);
    rest = rest.slice(separatorIndex + 1);
  }
}

function isModifierName(input: string): boolean {
  const modifier = input.toLowerCase();
  return (
    modifier === "ctrl" ||
    modifier === "control" ||
    modifier === "mod" ||
    modifier === "meta" ||
    modifier === "cmd" ||
    modifier === "alt" ||
    modifier === "option" ||
    modifier === "shift"
  );
}
