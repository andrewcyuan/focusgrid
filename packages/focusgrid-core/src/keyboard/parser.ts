import { createKeyStroke } from "./normalize";
import type { KeySequence, KeyStroke } from "./keymap";

export type KeySequenceValidationResult =
  | {
      ok: true;
      sequence: KeySequence;
      value: string;
    }
  | {
      ok: false;
      error: string;
    };

export function parseKeySequence(input: string): KeySequence {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseKeyStroke);
}

export function normalizeKeySequenceInput(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeKeyStrokeInput)
    .join(" ");
}

export function validateKeySequenceInput(
  input: string,
): KeySequenceValidationResult {
  const value = normalizeKeySequenceInput(input);

  try {
    return {
      ok: true,
      sequence: parseKeySequence(value),
      value,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid key sequence",
    };
  }
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

function normalizeKeyStrokeInput(input: string): string {
  if (!input.includes("+")) {
    return input;
  }

  const parts = input.split("+");
  const key = parts.at(-1);
  const modifiers = parts.slice(0, -1);

  if (!key || modifiers.length === 0 || !modifiers.every(isModifierName)) {
    return input;
  }

  return [...modifiers, key].join("-");
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
