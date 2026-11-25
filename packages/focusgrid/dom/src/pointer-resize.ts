import type { ComputedHandle, FocusGridController } from "@andrewcyuan/focusgrid/core";

type Drag = {
  pointerId: number;
  handle: ComputedHandle;
  startX: number;
  startY: number;
  startSizes: number[];
  captureTarget: Element;
  deltaPx: number;
  cancelFrame: (() => void) | null;
};

function requestFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
}

export class PointerResizeController {
  private drag: Drag | null = null;

  constructor(private readonly controller: FocusGridController) {}

  startResize(event: PointerEvent, handle: ComputedHandle, captureTarget: Element): void {
    event.preventDefault();
    this.destroy();

    const startSizes = this.controller.getSplitSizes(handle.splitId);
    if (!startSizes) return;

    this.drag = {
      pointerId: event.pointerId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startSizes,
      captureTarget,
      deltaPx: 0,
      cancelFrame: null,
    };
    try {
      captureTarget.setPointerCapture(event.pointerId);
    } catch {
      // Document-level listeners keep the drag alive when capture is unavailable.
    }
    const ownerDocument = captureTarget.ownerDocument;
    ownerDocument.addEventListener("pointermove", this.updateResize);
    ownerDocument.addEventListener("pointerup", this.endResize);
    ownerDocument.addEventListener("pointercancel", this.endResize);
  }

  readonly updateResize = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    drag.deltaPx = drag.handle.direction === "horizontal" ? event.clientX - drag.startX : event.clientY - drag.startY;
    if (drag.cancelFrame) return;
    drag.cancelFrame = requestFrame(() => {
      drag.cancelFrame = null;
      this.applyResize(drag);
    });
  };

  readonly endResize = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.cancelFrame) {
      drag.cancelFrame();
      drag.cancelFrame = null;
      this.applyResize(drag);
    }
    this.destroy();
  };

  destroy(): void {
    const drag = this.drag;
    if (!drag) return;

    drag.cancelFrame?.();
    const ownerDocument = drag.captureTarget.ownerDocument;
    ownerDocument.removeEventListener("pointermove", this.updateResize);
    ownerDocument.removeEventListener("pointerup", this.endResize);
    ownerDocument.removeEventListener("pointercancel", this.endResize);
    try {
      drag.captureTarget.releasePointerCapture(drag.pointerId);
    } catch {
      // The drag is already ending; a failed release must not block cleanup.
    }
    this.drag = null;
  }

  private applyResize(drag: Drag): void {
    this.controller.resizeHandle(drag.handle.splitId, {
      index: drag.handle.index,
      deltaPx: drag.deltaPx,
      snapshotSizes: drag.startSizes,
    });
  }
}
