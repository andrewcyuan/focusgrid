import {
  KeyRouter,
  createKeyStroke,
  type KeyBinding,
  type KeyStroke,
  type Workspace,
} from "@focusgrid/core";
import { tinykeys } from "tinykeys";
import { isEditableTarget } from "./focus";

export type KeyboardListenerOptions = {
  keymap?: KeyBinding[];
  mode?: "normal" | "insert" | "resize";
};

export class KeyboardListener {
  private readonly router: KeyRouter;
  private readonly mode: "normal" | "insert" | "resize";
  private unsubscribe: (() => void) | null = null;
  private readonly onKey = (event: KeyboardEvent) => {
    const stroke = normalizeKeyboardEvent(event);
    const result = this.router.handle(stroke, {
      activePaneId: this.workspace.getState().activePaneId,
      inputFocused: isEditableTarget(event.target),
      mode: this.mode,
    });

    if (!result.matched) {
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
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = tinykeys(
      this.rootEl,
      {
        "[Control]+[Meta]+[Alt]+[Shift]+(.+)": this.onKey,
      },
      {
        ignore: () => false,
      },
    );
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

export function normalizeKeyboardEvent(event: KeyboardEvent): KeyStroke {
  return createKeyStroke({
    key: event.key,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey,
  });
}
