import type { KeyBinding, FocusGridController } from "@focusgrid/focusgrid/core";
import { KeyboardListener } from "./keyboard-listener";
import { RootResizeObserver } from "./resize-observer";
import { ApplicationFocusManager } from "./application-focus-manager";

export type FocusGridDomFocusManagement = {
  mode: "application";
  scope: HTMLElement | null;
};

export type FocusGridDomControllerOptions = {
  keymap?: KeyBinding[];
  focusManagement?: FocusGridDomFocusManagement;
};

export class FocusGridDomController {
  private mountedResources: {
    keyboard: KeyboardListener;
    resizeObserver: RootResizeObserver;
    focusManager?: ApplicationFocusManager;
  } | null = null;

  constructor(
    private readonly controller: FocusGridController,
    private readonly rootEl: HTMLElement,
    private readonly options: FocusGridDomControllerOptions = {},
  ) {}

  mount(): void {
    if (this.mountedResources) {
      return;
    }

    if (
      this.options.focusManagement?.mode === "application" &&
      !this.options.focusManagement.scope?.contains(this.rootEl)
    ) {
      throw new Error(
        "FocusGrid application focus management requires its scope to contain the Focusgrid root.",
      );
    }

    this.rootEl.tabIndex = this.rootEl.tabIndex < 0 ? 0 : this.rootEl.tabIndex;
    const keyboard = new KeyboardListener(this.controller, this.rootEl, {
      keymap: this.options.keymap,
    });
    const resizeObserver = new RootResizeObserver(this.controller, this.rootEl);
    let focusManager: ApplicationFocusManager | undefined;
    if (this.options.focusManagement?.mode === "application") {
      focusManager = new ApplicationFocusManager(
        this.controller,
        this.rootEl,
        this.options.focusManagement.scope!,
      );
    }

    this.mountedResources = { keyboard, resizeObserver, focusManager };
    try {
      keyboard.mount();
      resizeObserver.mount();
      focusManager?.mount();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  destroy(): void {
    if (!this.mountedResources) {
      return;
    }

    const resources = this.mountedResources;
    this.mountedResources = null;
    resources.keyboard.destroy();
    resources.resizeObserver.destroy();
    resources.focusManager?.destroy();
  }
}
