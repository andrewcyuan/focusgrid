import { createKeyStroke } from "./normalize";
import type { ShortcutMatchResult, KeyStroke } from "./keymap";
import type { KeyRouter } from "./trie";

export type KeyboardEventRouteOptions<
  TContext = unknown,
  TAction extends string = string,
  TArgs = unknown,
> = {
  context: TContext;
  ignoreEvent?: (event: KeyboardEvent) => boolean;
  onMatch?: (
    match: Extract<ShortcutMatchResult<TAction, TArgs>, { matched: true }>,
    event: KeyboardEvent,
  ) => void;
};

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

export function routeKeyboardEvent<
  TContext = unknown,
  TAction extends string = string,
  TArgs = unknown,
>(
  event: KeyboardEvent,
  router: KeyRouter<TContext, TAction, TArgs>,
  options: KeyboardEventRouteOptions<TContext, TAction, TArgs>,
): ShortcutMatchResult<TAction, TArgs> | null {
  if (options.ignoreEvent?.(event) || isModifierOnlyKey(event.key)) {
    return null;
  }

  const result = router.handle(normalizeKeyboardEvent(event), options.context);

  if (!result.matched) {
    if (result.pending || result.preventDefault) {
      preventAndStop(event);
    }

    return result;
  }

  if (result.preventDefault) {
    preventAndStop(event);
  }

  options.onMatch?.(result, event);

  return result;
}

function preventAndStop(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
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
