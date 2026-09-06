import type {
  FocusGridController,
  FocusGridControllerState,
  PaneId,
} from "@focusgrid/focusgrid/core";
import { hasInteractiveOwner, isTabbableElement } from "./interactivity";

const PANE_SELECTOR = ".FocusgridPaneView";

export class ApplicationFocusManager {
  private readonly rememberedFocus = new Map<PaneId, HTMLElement>();
  private readonly ownerDocument: Document;
  private readonly ownerWindow: Window | null;
  private mountState: {
    unsubscribe: () => void;
    pendingRedirect?: number;
  } | null = null;

  constructor(
    private readonly controller: FocusGridController,
    private readonly rootEl: HTMLElement,
    private readonly scopeEl: HTMLElement,
  ) {
    this.ownerDocument = rootEl.ownerDocument;
    this.ownerWindow = this.ownerDocument.defaultView;
  }

  mount(): void {
    if (this.mountState) {
      return;
    }

    if (!this.scopeEl.contains(this.rootEl)) {
      throw new Error(
        "FocusGrid application focus management requires its scope to contain the Focusgrid root.",
      );
    }

    this.rootEl.addEventListener("focusin", this.onFocusIn);
    this.scopeEl.addEventListener("pointerdown", this.onPointerDown);
    this.ownerWindow?.addEventListener("focus", this.onWindowFocus);
    this.mountState = {
      unsubscribe: this.controller.subscribe(this.onControllerChange),
    };
    this.scheduleRestore();
  }

  destroy(): void {
    if (!this.mountState) {
      return;
    }

    this.rootEl.removeEventListener("focusin", this.onFocusIn);
    this.scopeEl.removeEventListener("pointerdown", this.onPointerDown);
    this.ownerWindow?.removeEventListener("focus", this.onWindowFocus);
    const { unsubscribe } = this.mountState;
    this.cancelPendingRedirect();
    this.mountState = null;
    unsubscribe();
    this.rememberedFocus.clear();
  }

  private readonly onFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !this.rootEl.contains(target)) {
      return;
    }

    const pane = findContainingPane(target, this.rootEl);
    const paneId = pane?.dataset.paneId;
    if (!pane || !paneId) {
      return;
    }

    if (target !== pane) {
      this.rememberedFocus.set(paneId, target);
    }

    if (this.controller.getState().activePaneId !== paneId) {
      this.controller.api.focus(paneId);
    }
  };

  private readonly onControllerChange = (
    nextState: FocusGridControllerState,
    previousState: FocusGridControllerState,
  ): void => {
    if (nextState.activePaneId === previousState.activePaneId) {
      return;
    }

    const activeElement = this.ownerDocument.activeElement;
    if (
      this.rootEl.contains(activeElement) ||
      isUnownedFocus(activeElement, this.ownerDocument)
    ) {
      this.restoreActivePane();
    }
  };

  private readonly onWindowFocus = (): void => {
    this.scheduleRestore();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element) || this.rootEl.contains(target)) {
      return;
    }

    if (hasInteractiveOwner(target, this.scopeEl)) {
      return;
    }

    this.scheduleRestore(this.ownerDocument.activeElement);
  };

  private scheduleRestore(previousActiveElement?: Element | null): void {
    this.cancelPendingRedirect();
    const schedule = this.ownerWindow?.setTimeout.bind(this.ownerWindow) ?? setTimeout;
    const pendingRedirect = schedule(() => {
      if (!this.mountState) {
        return;
      }
      this.mountState = { ...this.mountState, pendingRedirect: undefined };

      const activeElement = this.ownerDocument.activeElement;
      if (
        !this.rootEl.contains(activeElement) &&
        (
          isUnownedFocus(activeElement, this.ownerDocument) ||
          activeElement === previousActiveElement
        )
      ) {
        this.restoreActivePane();
      }
    }, 0) as unknown as number;
    if (this.mountState) {
      this.mountState = { ...this.mountState, pendingRedirect };
    }
  }

  private cancelPendingRedirect(): void {
    if (!this.mountState || this.mountState.pendingRedirect === undefined) {
      return;
    }

    const cancel = this.ownerWindow?.clearTimeout.bind(this.ownerWindow) ?? clearTimeout;
    cancel(this.mountState.pendingRedirect);
    this.mountState = { ...this.mountState, pendingRedirect: undefined };
  }

  private restoreActivePane(): void {
    const activePaneId = this.controller.getState().activePaneId;
    if (!activePaneId) {
      return;
    }

    const pane = findPaneById(this.rootEl, activePaneId);
    if (!pane) {
      return;
    }

    const remembered = this.rememberedFocus.get(activePaneId);
    if (remembered) {
      if (isValidRememberedTarget(remembered, pane)) {
        if (tryFocus(remembered, this.ownerDocument)) {
          return;
        }
      } else {
        this.rememberedFocus.delete(activePaneId);
      }
    }

    for (const candidate of findTabbableDescendants(pane)) {
      if (candidate !== remembered && tryFocus(candidate, this.ownerDocument)) {
        return;
      }
    }

    tryFocus(pane, this.ownerDocument);
  }
}

export function isUnownedFocus(
  activeElement: Element | null,
  ownerDocument: Document,
): boolean {
  if (
    activeElement === null ||
    activeElement === ownerDocument.body ||
    activeElement === ownerDocument.documentElement
  ) {
    return true;
  }

  return activeElement instanceof HTMLElement && !hasInteractiveOwner(
    activeElement,
    ownerDocument.documentElement,
  );
}

function isValidRememberedTarget(
  target: HTMLElement,
  pane: HTMLElement,
): boolean {
  return target.isConnected && pane.contains(target) && isTabbableElement(target);
}

function findTabbableDescendants(pane: HTMLElement): HTMLElement[] {
  return Array.from(
    pane.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [contenteditable], [tabindex]',
    ),
  ).filter(isTabbableElement);
}

function findContainingPane(
  target: HTMLElement,
  rootEl: HTMLElement,
): HTMLElement | null {
  const pane = target.closest<HTMLElement>(PANE_SELECTOR);
  return pane && rootEl.contains(pane) ? pane : null;
}

function findPaneById(rootEl: HTMLElement, paneId: PaneId): HTMLElement | null {
  return Array.from(rootEl.querySelectorAll<HTMLElement>(PANE_SELECTOR)).find(
    (pane) => pane.dataset.paneId === paneId,
  ) ?? null;
}

function tryFocus(element: HTMLElement, ownerDocument: Document): boolean {
  try {
    element.focus({ preventScroll: true });
    return ownerDocument.activeElement === element;
  } catch {
    return false;
  }
}
