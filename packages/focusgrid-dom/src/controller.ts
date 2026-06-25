import type { KeyBinding, FocusGridController } from "@focusgrid/core";
import { KeyboardListener } from "./keyboard-listener";
import { RootResizeObserver } from "./resize-observer";

export type FocusGridDomControllerOptions = {
  keymap?: KeyBinding[];
};

export class FocusGridDomController {
  private keyboard?: KeyboardListener;
  private resizeObserver?: RootResizeObserver;

  constructor(
    private readonly controller: FocusGridController,
    private readonly rootEl: HTMLElement,
    private readonly options: FocusGridDomControllerOptions = {},
  ) {}

  mount(): void {
    this.rootEl.tabIndex = this.rootEl.tabIndex < 0 ? 0 : this.rootEl.tabIndex;
    this.keyboard = new KeyboardListener(this.controller, this.rootEl, {
      keymap: this.options.keymap,
    });
    this.resizeObserver = new RootResizeObserver(this.controller, this.rootEl);

    this.keyboard.mount();
    this.resizeObserver.mount();
  }

  destroy(): void {
    this.keyboard?.destroy();
    this.resizeObserver?.destroy();
    this.keyboard = undefined;
    this.resizeObserver = undefined;
  }
}
