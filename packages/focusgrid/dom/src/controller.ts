import type { ShortcutBinding, FocusGridController } from "@andrewcyuan/focusgrid/core";
import type { ShortcutEngine, ShortcutRegistration } from "@andrewcyuan/shortcut-engine";
import { RootResizeObserver } from "./resize-observer";
import { ApplicationFocusManager } from "./application-focus-manager";

export type FocusGridDomFocusManagement = {
  mode: "application";
  scope: HTMLElement | null;
};

export type FocusGridDomControllerOptions = {
  keymap?: readonly ShortcutBinding[];
  engine: ShortcutEngine;
  scopeId: string;
  parentScopeId: string | null;
  focusManagement?: FocusGridDomFocusManagement;
};

export class FocusGridDomController {
  private mountedResources: {
    cleanupShortcuts: () => void;
    bindings: ShortcutRegistration;
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
    const { engine, scopeId, parentScopeId } = this.options;
    const removeScope = engine.registerScope({ id: scopeId, parentId: parentScopeId });
    let bindings: ShortcutRegistration;
    try {
      bindings = engine.registerBindings(scopeId, this.options.keymap ?? []);
    } catch (error) {
      removeScope();
      throw error;
    }
    const previousScope = this.rootEl.getAttribute("data-shortcut-scope");
    this.rootEl.setAttribute("data-shortcut-scope", scopeId);
    const onFocusIn = (event: FocusEvent) => {
      const pane = event.composedPath().find(target =>
        target instanceof HTMLElement &&
        target.hasAttribute("data-pane-id") &&
        (target.closest(".FocusgridFocusGrid") ?? this.rootEl) === this.rootEl,
      ) as HTMLElement | undefined;
      if (pane?.dataset.paneId) this.controller.focus(pane.dataset.paneId);
    };
    this.rootEl.addEventListener("focusin", onFocusIn);
    const unsubscribe = this.controller.subscribe((next, previous) => {
      if (next.activePaneId !== previous.activePaneId && engine.isScopeActive(scopeId)) {
        engine.reset();
      }
    });
    const cleanupShortcuts = () => {
      this.rootEl.removeEventListener("focusin", onFocusIn);
      unsubscribe();
      bindings.dispose();
      removeScope();
      if (previousScope === null) this.rootEl.removeAttribute("data-shortcut-scope");
      else this.rootEl.setAttribute("data-shortcut-scope", previousScope);
    };
    const resizeObserver = new RootResizeObserver(this.controller, this.rootEl);
    let focusManager: ApplicationFocusManager | undefined;
    if (this.options.focusManagement?.mode === "application") {
      focusManager = new ApplicationFocusManager(
        this.controller,
        this.rootEl,
        this.options.focusManagement.scope!,
      );
    }

    this.mountedResources = { cleanupShortcuts, bindings, resizeObserver, focusManager };
    try {
      resizeObserver.mount();
      focusManager?.mount();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  setKeymap(bindings: readonly ShortcutBinding[]): void {
    this.mountedResources?.bindings.update(bindings);
    this.options = { ...this.options, keymap: bindings };
  }

  destroy(): void {
    if (!this.mountedResources) {
      return;
    }

    const resources = this.mountedResources;
    this.mountedResources = null;
    resources.cleanupShortcuts();
    resources.resizeObserver.destroy();
    resources.focusManager?.destroy();
  }
}
