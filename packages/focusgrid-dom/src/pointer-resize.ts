import {
  type ComputedHandle,
  type FocusGridController,
  type LayoutNode,
  type NodeId,
  type SplitNode,
} from "@focusgrid/core";
import { cancelFrame, requestFrame, type FrameRequest } from "./frame";

type ResizeDrag = {
  pointerId: number;
  splitId: string;
  index: number;
  startX: number;
  startY: number;
  startSizes: number[];
  ownerDocument: Document | null;
  captureTarget: PointerCaptureTarget | null;
};

type PointerCaptureTarget = Element & {
  setPointerCapture?: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
  releasePointerCapture?: (pointerId: number) => void;
};

export class PointerResizeController {
  private drag: ResizeDrag | null = null;
  private pendingDeltaPx = 0;
  private pendingFrame: FrameRequest | null = null;
  private readonly onDocumentPointerMove = (event: PointerEvent): void => {
    this.updateResize(event);
  };
  private readonly onDocumentPointerUp = (event: PointerEvent): void => {
    this.endResize(event);
  };
  private readonly onDocumentPointerCancel = (event: PointerEvent): void => {
    this.endResize(event);
  };

  constructor(private readonly controller: FocusGridController) {}

  startResize(
    event: PointerEvent,
    handle: ComputedHandle,
    captureTarget?: Element | null,
  ): void {
    event.preventDefault();
    this.destroy();

    const ownerDocument = this.resolveOwnerDocument(event, captureTarget);
    const pointerCaptureTarget = this.resolveCaptureTarget(captureTarget);

    const split = findSplitNode(this.controller.getState().root, handle.splitId);

    this.drag = {
      pointerId: event.pointerId,
      splitId: handle.splitId,
      index: handle.index,
      startX: event.clientX,
      startY: event.clientY,
      startSizes: split ? [...split.sizes] : [],
      ownerDocument,
      captureTarget: pointerCaptureTarget,
    };

    this.setPointerCapture(pointerCaptureTarget, event.pointerId);
    this.addDocumentListeners(ownerDocument);
  }

  updateResize(event: PointerEvent): void {
    if (!this.drag || this.drag.pointerId !== event.pointerId) {
      return;
    }

    const split = findSplitNode(this.controller.getState().root, this.drag.splitId);

    if (!split) {
      return;
    }

    const deltaPx =
      split.direction === "horizontal"
        ? event.clientX - this.drag.startX
        : event.clientY - this.drag.startY;

    this.pendingDeltaPx = deltaPx;

    if (this.pendingFrame) {
      return;
    }

    this.pendingFrame = requestFrame(() => {
      this.pendingFrame = null;
      this.dispatchPendingResize();
    });
  }

  endResize(event: PointerEvent): void {
    if (!this.drag || this.drag.pointerId !== event.pointerId) {
      return;
    }

    this.flushPendingFrame();
    this.finishDrag();
  }

  destroy(): void {
    this.cancelPendingFrame();
    this.finishDrag();
  }

  private finishDrag(): void {
    if (!this.drag) {
      return;
    }

    const { captureTarget, ownerDocument, pointerId } = this.drag;

    this.removeDocumentListeners(ownerDocument);
    this.releasePointerCapture(captureTarget, pointerId);
    this.drag = null;
  }

  private flushPendingFrame(): void {
    if (!this.pendingFrame) {
      return;
    }

    cancelFrame(this.pendingFrame);
    this.pendingFrame = null;
    this.dispatchPendingResize();
  }

  private dispatchPendingResize(): void {
    if (!this.drag) {
      return;
    }

    if (!findSplitNode(this.controller.getState().root, this.drag.splitId)) {
      return;
    }

    this.controller.api.resizeHandle(this.drag.splitId, {
      index: this.drag.index,
      deltaPx: this.pendingDeltaPx,
      snapshotSizes: this.drag.startSizes,
    });
  }

  private cancelPendingFrame(): void {
    if (!this.pendingFrame) {
      return;
    }

    cancelFrame(this.pendingFrame);
    this.pendingFrame = null;
  }

  private addDocumentListeners(ownerDocument: Document | null): void {
    ownerDocument?.addEventListener("pointermove", this.onDocumentPointerMove);
    ownerDocument?.addEventListener("pointerup", this.onDocumentPointerUp);
    ownerDocument?.addEventListener("pointercancel", this.onDocumentPointerCancel);
  }

  private removeDocumentListeners(ownerDocument: Document | null): void {
    ownerDocument?.removeEventListener("pointermove", this.onDocumentPointerMove);
    ownerDocument?.removeEventListener("pointerup", this.onDocumentPointerUp);
    ownerDocument?.removeEventListener("pointercancel", this.onDocumentPointerCancel);
  }

  private resolveOwnerDocument(
    event: PointerEvent,
    captureTarget?: Element | null,
  ): Document | null {
    if (captureTarget?.ownerDocument) {
      return captureTarget.ownerDocument;
    }

    if (
      typeof Element !== "undefined" &&
      event.target instanceof Element &&
      event.target.ownerDocument
    ) {
      return event.target.ownerDocument;
    }

    return typeof document === "undefined" ? null : document;
  }

  private resolveCaptureTarget(
    captureTarget?: Element | null,
  ): PointerCaptureTarget | null {
    if (!captureTarget) {
      return null;
    }

    if (
      "setPointerCapture" in captureTarget ||
      "releasePointerCapture" in captureTarget
    ) {
      return captureTarget as PointerCaptureTarget;
    }

    return null;
  }

  private setPointerCapture(
    target: PointerCaptureTarget | null,
    pointerId: number,
  ): void {
    try {
      target?.setPointerCapture?.(pointerId);
    } catch {
      // Document-level listeners keep the drag alive when capture is unavailable.
    }
  }

  private releasePointerCapture(
    target: PointerCaptureTarget | null,
    pointerId: number,
  ): void {
    if (!target?.releasePointerCapture) {
      return;
    }

    try {
      if (!target.hasPointerCapture || target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      // The drag is already ending; failed release should not block cleanup.
    }
  }
}

function findSplitNode(root: LayoutNode, splitId: NodeId): SplitNode | null {
  if (root.kind === "split") {
    if (root.id === splitId) {
      return root;
    }

    for (const child of root.children) {
      const match = findSplitNode(child, splitId);

      if (match) {
        return match;
      }
    }
  }

  return null;
}
