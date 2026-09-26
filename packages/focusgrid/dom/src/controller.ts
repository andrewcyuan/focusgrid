import type { DomController, PaneId } from "@andrewcyuan/focusgrid/core";

/** Attach the renderer root; pane elements are resolved only when focus is requested. */
export class FocusGridDomController implements DomController {
  private root: HTMLElement | null = null;

  setRoot(root: HTMLElement | null): void {
    this.root = root;
  }

  focus(paneId: PaneId): boolean {
    const root = this.root;
    if (!root) return false;
    const pane = [...root.querySelectorAll<HTMLElement>("[data-pane-id]")].find(element =>
      element.dataset.paneId === paneId && element.closest(".FocusgridFocusGrid") === root,
    );
    if (!pane) return false;
    const ownsFocus = () => pane.contains(root.ownerDocument.activeElement);
    if (ownsFocus()) return true;
    pane.focus({ preventScroll: true });
    return ownsFocus();
  }
}
