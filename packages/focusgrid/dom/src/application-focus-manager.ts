import type { FocusGridController, PaneId } from "@focusgrid/focusgrid/core";

const PANE_SELECTOR = ".FocusgridPaneView";

const INTERACTIVE_ROLES = new Set([
  "alertdialog",
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "grid",
  "gridcell",
  "link",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "radiogroup",
  "scrollbar",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "tablist",
  "textbox",
  "toolbar",
  "tree",
  "treegrid",
  "treeitem",
]);

export class ApplicationFocusManager {
  private readonly rememberedFocus = new Map<PaneId, HTMLElement>();
  private readonly ownerDocument: Document;
  private readonly ownerWindow: Window | null;
  private activePaneId: PaneId | null;
  private unsubscribe?: () => void;
  private pendingRedirect?: number;
  private mounted = false;

  constructor(
    private readonly controller: FocusGridController,
    private readonly rootEl: HTMLElement,
    private readonly scopeEl: HTMLElement,
  ) {
    this.ownerDocument = rootEl.ownerDocument;
    this.ownerWindow = this.ownerDocument.defaultView;
    this.activePaneId = controller.getState().activePaneId;
  }

  mount(): void {
    if (this.mounted) {
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
    this.unsubscribe = this.controller.subscribe(this.onControllerChange);
    this.mounted = true;
    this.scheduleRestore();
  }

  destroy(): void {
    if (!this.mounted) {
      return;
    }

    this.rootEl.removeEventListener("focusin", this.onFocusIn);
    this.scopeEl.removeEventListener("pointerdown", this.onPointerDown);
    this.ownerWindow?.removeEventListener("focus", this.onWindowFocus);
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.cancelPendingRedirect();
    this.rememberedFocus.clear();
    this.mounted = false;
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

  private readonly onControllerChange = (): void => {
    const nextActivePaneId = this.controller.getState().activePaneId;
    if (nextActivePaneId === this.activePaneId) {
      return;
    }

    this.activePaneId = nextActivePaneId;
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
    this.pendingRedirect = schedule(() => {
      this.pendingRedirect = undefined;
      if (!this.mounted) {
        return;
      }

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
  }

  private cancelPendingRedirect(): void {
    if (this.pendingRedirect === undefined) {
      return;
    }

    const cancel = this.ownerWindow?.clearTimeout.bind(this.ownerWindow) ?? clearTimeout;
    cancel(this.pendingRedirect);
    this.pendingRedirect = undefined;
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

export function hasInteractiveOwner(target: Element, boundary: HTMLElement): boolean {
  let element: Element | null = target;

  while (element && element !== boundary) {
    if (element instanceof HTMLElement && isInteractiveElement(element)) {
      return true;
    }
    element = element.parentElement;
  }

  return boundary instanceof HTMLElement && isInteractiveElement(boundary);
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

export function isTabbableElement(element: HTMLElement): boolean {
  if (isUnavailable(element)) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  if (tagName === "a" && !element.hasAttribute("href")) {
    return false;
  }

  if (
    tagName === "button" ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    (tagName === "a" && element.hasAttribute("href")) ||
    element.isContentEditable
  ) {
    return element.tabIndex >= 0;
  }

  return element.hasAttribute("tabindex") && element.tabIndex >= 0;
}

function isInteractiveElement(element: HTMLElement): boolean {
  if (isUnavailable(element)) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();

  return (
    element.isContentEditable ||
    element.tabIndex >= 0 ||
    (tagName === "a" && element.hasAttribute("href")) ||
    tagName === "button" ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    tagName === "dialog" ||
    tagName === "summary" ||
    (role !== undefined && INTERACTIVE_ROLES.has(role))
  );
}

function isUnavailable(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;

  while (current) {
    if (
      current.hidden ||
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true" ||
      current.getAttribute("aria-disabled") === "true" ||
      ("disabled" in current && Boolean(current.disabled))
    ) {
      return true;
    }

    const view = current.ownerDocument.defaultView;
    if (view) {
      const style = view.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") {
        return true;
      }
    }

    current = current.parentElement;
  }

  return false;
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
