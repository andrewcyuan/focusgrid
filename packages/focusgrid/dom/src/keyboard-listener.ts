import {
  type KeyBinding,
  type FocusGridController,
  type ShortcutContext,
} from "@focusgrid/focusgrid/core";
import {
  KeyRouter,
  isEditableTarget,
  routeKeyboardEvent,
} from "@focusgrid/shortcut-engine";

export type KeyboardListenerOptions = {
  keymap?: KeyBinding[];
};

export class KeyboardListener {
  private readonly router: KeyRouter<ShortcutContext>;
  private mounted = false;
  private readonly onKey = (event: KeyboardEvent) => {
    routeKeyboardEvent(event, this.router, {
      context: {
        activePaneId: this.controller.getState().activePaneId,
        inputFocused: isEditableTarget(event.target),
      },
      onMatch: (result) => {
        this.controller.commands.run(
          result.action,
          this.controller,
          result.args,
        );
      },
    });
  };

  constructor(
    private readonly controller: FocusGridController,
    private readonly rootEl: HTMLElement,
    options: KeyboardListenerOptions = {},
  ) {
    this.router = new KeyRouter(options.keymap ?? []);
  }

  mount(): void {
    if (this.mounted) {
      return;
    }

    this.rootEl.addEventListener("keydown", this.onKey, { capture: true });
    this.mounted = true;
  }

  destroy(): void {
    if (!this.mounted) {
      return;
    }

    this.rootEl.removeEventListener("keydown", this.onKey, { capture: true });
    this.mounted = false;
  }
}
