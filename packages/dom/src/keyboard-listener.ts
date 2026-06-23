import {
  KeyRouter,
  createKeyStroke,
  type KeyBinding,
  type KeyStroke,
  type Workspace,
} from "@focusgrid/core";
import { isEditableTarget } from "./focus";

export type KeyboardListenerOptions = {
  keymap?: KeyBinding[];
  mode?: "normal" | "insert" | "resize";
};

export class KeyboardListener {
  private readonly router: KeyRouter;
  private readonly mode: "normal" | "insert" | "resize";
  private mounted = false;
  private readonly onKey = (event: KeyboardEvent) => {
    if (isModifierOnlyKey(event.key)) {
      return;
    }

    const stroke = normalizeKeyboardEvent(event);
    const result = this.router.handle(stroke, {
      activePaneId: this.workspace.getState().activePaneId,
      inputFocused: isEditableTarget(event.target),
      mode: this.mode,
    });

    if (!result.matched) {
      if (result.pending || result.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }

      return;
    }

    if (result.preventDefault) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.workspace.commands.run(result.command, this.workspace, result.args);
  };

  constructor(
    private readonly workspace: Workspace,
    private readonly rootEl: HTMLElement,
    options: KeyboardListenerOptions = {},
  ) {
    this.router = new KeyRouter(options.keymap ?? []);
    this.mode = options.mode ?? "normal";
  }

  mount(): void {
    if (this.mounted) {
      return;
    }

    this.rootEl.addEventListener("keydown", this.onKey, { capture: true });
    this.mounted = true;
  }

  destroy(): void {
    this.rootEl.removeEventListener("keydown", this.onKey, { capture: true });
    this.mounted = false;
  }
}

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

function isModifierOnlyKey(key: string): boolean {
  return (
    key === "Alt" ||
    key === "AltGraph" ||
    key === "Control" ||
    key === "Meta" ||
    key === "Shift"
  );
}
