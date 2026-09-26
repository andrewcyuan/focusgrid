import type { FocusGridController } from "@andrewcyuan/focusgrid/core";
import { RootResizeObserver } from "./resize-observer";
import { ApplicationFocusManager } from "./application-focus-manager";

export type FocusGridDomFocusManagement = {
  mode: "application";
  scope: HTMLElement | null;
};

export type FocusGridDomControllerOptions = {
  focusManagement?: FocusGridDomFocusManagement;
};

export class FocusGridDomController {
  private mountedResources: {
    cleanupFocus: () => void;
    resizeObserver: RootResizeObserver;
    focusManager?: ApplicationFocusManager;
  } | null = null;

  constructor(
    private readonly controller: FocusGridController,
    private readonly rootEl: HTMLElement,
    private options: FocusGridDomControllerOptions,
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
    const onFocusIn = (event: FocusEvent) => {
      const pane = event.composedPath().find(target =>
        target instanceof HTMLElement &&
        target.hasAttribute("data-pane-id") &&
        (target.closest(".FocusgridFocusGrid") ?? this.rootEl) === this.rootEl,
      ) as HTMLElement | undefined;
      if (pane?.dataset.paneId) this.controller.focus(pane.dataset.paneId);
    };
    this.rootEl.addEventListener("focusin", onFocusIn);
    const cleanupFocus = () => this.rootEl.removeEventListener("focusin", onFocusIn);
    const resizeObserver = new RootResizeObserver(this.controller, this.rootEl);
    let focusManager: ApplicationFocusManager | undefined;
    if (this.options.focusManagement?.mode === "application") {
      focusManager = new ApplicationFocusManager(
        this.controller,
        this.rootEl,
        this.options.focusManagement.scope!,
      );
    }

    this.mountedResources = { cleanupFocus, resizeObserver, focusManager };
    try {
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
    resources.cleanupFocus();
    resources.resizeObserver.destroy();
    resources.focusManager?.destroy();
  }
}
