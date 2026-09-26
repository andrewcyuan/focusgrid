import type { FocusGridController } from "@andrewcyuan/focusgrid/core";
import type { FocusGridDomController } from "./controller";
import { PointerResizeController } from "./pointer-resize";
import { observeRootSize } from "./resize-observer";
import { shouldFocusPaneShellForPointer } from "./interactivity";

/** Own native grid interactions; React only attaches and detaches the root. */
export function mountFocusGrid(root: HTMLElement, controller: FocusGridController, dom: FocusGridDomController): () => void {
  dom.setRoot(root);
  const resize = new PointerResizeController(controller);
  const ownedTarget = (event: Event) => {
    const target = event.target;
    return target instanceof Element && target.closest(".FocusgridFocusGrid") === root ? target : null;
  };
  const onFocus = (event: FocusEvent) => {
    const paneId = ownedTarget(event)?.closest<HTMLElement>("[data-pane-id]")?.dataset.paneId;
    if (paneId) controller.focus(paneId);
  };
  const onPointerDown = (event: PointerEvent) => {
    const target = ownedTarget(event);
    if (!target) return;
    const separator = target.closest<HTMLElement>("[data-resize-handle]");
    if (separator) {
      const handle = controller.getLayout().handles.find(handle => handle.id === separator.dataset.resizeHandle);
      if (handle) resize.startResize(event, handle, separator);
      return;
    }
    const pane = target.closest<HTMLElement>("[data-pane-id]");
    if (!pane?.dataset.paneId) return;
    controller.focus(pane.dataset.paneId);
    if (shouldFocusPaneShellForPointer(target, pane)) pane.focus({ preventScroll: true });
  };
  root.addEventListener("focusin", onFocus, true);
  root.addEventListener("pointerdown", onPointerDown);
  const stopObserving = observeRootSize(root, controller);
  return () => {
    root.removeEventListener("focusin", onFocus, true);
    root.removeEventListener("pointerdown", onPointerDown);
    resize.destroy();
    stopObserving();
    dom.setRoot(null);
  };
}
