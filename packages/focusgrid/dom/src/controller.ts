import type { KeyBinding, FocusGridController } from "@focusgrid/focusgrid/core";
import { KeyboardListener } from "./keyboard-listener";
import { RootResizeObserver } from "./resize-observer";

export type FocusGridDomControllerOptions = {
  keymap?: KeyBinding[];
};

export class FocusGridDomController {
  private keyboard?: KeyboardListener;
  private resizeObserver?: RootResizeObserver;
  private mounted = false;

  constructor(
    private readonly controller: FocusGridController,
    private readonly rootEl: HTMLElement,
    private readonly options: FocusGridDomControllerOptions = {},
  ) {}

  mount(): void {
    if (this.mounted) {
      return;
    }

    this.rootEl.tabIndex = this.rootEl.tabIndex < 0 ? 0 : this.rootEl.tabIndex;
    this.keyboard = new KeyboardListener(this.controller, this.rootEl, {
      keymap: this.options.keymap,
    });
    this.resizeObserver = new RootResizeObserver(this.controller, this.rootEl);

    this.keyboard.mount();
    this.resizeObserver.mount();
    this.mounted = true;
  }

  destroy(): void {
    if (!this.mounted) {
      return;
    }

    this.keyboard?.destroy();
    this.resizeObserver?.destroy();
    this.keyboard = undefined;
    this.resizeObserver = undefined;
    this.mounted = false;
  }
}
