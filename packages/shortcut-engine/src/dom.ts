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

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;

  const element = target as EventTarget & {
    tagName?: string;
    isContentEditable?: boolean;
    type?: string;
    readOnly?: boolean;
    disabled?: boolean;
    getAttribute?: (name: string) => string | null;
  };

  if (element.isContentEditable) return true;

  const tagName = element.tagName?.toLowerCase();
  if (tagName === "textarea" || tagName === "select") {
    return !element.disabled;
  }

  if (tagName === "input") {
    const type = element.type?.toLowerCase() ?? "text";
    return !element.disabled && !element.readOnly && EDITABLE_INPUT_TYPES.has(type);
  }

  return element.getAttribute?.("role")?.toLowerCase() === "textbox";
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

const EDITABLE_INPUT_TYPES = new Set([
  "date",
  "datetime-local",
  "email",
  "file",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);
