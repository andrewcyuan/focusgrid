import { createKeyStroke } from "./normalize";
import type { KeyStroke } from "./keymap";

export function normalizeKeyboardEvent(event: KeyboardEvent): KeyStroke {
  const key = normalizeEventKey(event);

  return createKeyStroke({
    key,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey && !isShiftProducedSymbol(key),
  });
}

export function isModifierOnlyKey(key: string): boolean {
  return (
    key === "Alt" ||
    key === "AltGraph" ||
    key === "Control" ||
    key === "Meta" ||
    key === "Shift"
  );
}

function normalizeEventKey(event: KeyboardEvent): string {
  if (event.shiftKey && event.key.length === 1) {
    return SHIFTED_KEY_BY_BASE_KEY[event.key] ?? event.key;
  }

  return event.key;
}

function isShiftProducedSymbol(key: string): boolean {
  return key.length === 1 && key.toLowerCase() === key.toUpperCase();
}

const SHIFTED_KEY_BY_BASE_KEY: Record<string, string> = {
  "`": "~",
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": "\"",
  ",": "<",
  ".": ">",
  "/": "?",
};
