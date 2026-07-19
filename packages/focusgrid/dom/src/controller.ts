import type { KeyBinding, FocusGridController } from "@focusgrid/focusgrid/core";
import { KeyboardListener } from "./keyboard-listener";
import { RootResizeObserver } from "./resize-observer";
import { ApplicationFocusManager } from "./application-focus-manager";

export type FocusGridDomFocusManagement = {
  mode: "application";
  scope: HTMLElement;
};

export type FocusGridDomControllerOptions = {
  keymap?: KeyBinding[];
  focusManagement?: FocusGridDomFocusManagement;
};

export class FocusGridDomController {
  private keyboard?: KeyboardListener;
  private resizeObserver?: RootResizeObserver;
  private focusManager?: ApplicationFocusManager;
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

    if (
      this.options.focusManagement?.mode === "application" &&
      !this.options.focusManagement.scope.contains(this.rootEl)
    ) {
      throw new Error(
        "FocusGrid application focus management requires its scope to contain the Focusgrid root.",
      );
    }

    this.rootEl.tabIndex = this.rootEl.tabIndex < 0 ? 0 : this.rootEl.tabIndex;
    this.keyboard = new KeyboardListener(this.controller, this.rootEl, {
      keymap: this.options.keymap,
    });
    this.resizeObserver = new RootResizeObserver(this.controller, this.rootEl);
    if (this.options.focusManagement?.mode === "application") {
      this.focusManager = new ApplicationFocusManager(
        this.controller,
        this.rootEl,
        this.options.focusManagement.scope,
      );
    }

    this.keyboard.mount();
    this.resizeObserver.mount();
    this.focusManager?.mount();
    this.mounted = true;
  }

  destroy(): void {
    if (!this.mounted) {
      return;
    }

    this.keyboard?.destroy();
    this.resizeObserver?.destroy();
    this.focusManager?.destroy();
    this.keyboard = undefined;
    this.resizeObserver = undefined;
    this.focusManager = undefined;
    this.mounted = false;
  }
}
