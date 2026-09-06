import {
  type ComputedHandle,
  type FocusGridController,
  findSplitNode,
} from "@focusgrid/focusgrid/core";
import { cancelFrame, requestFrame, type FrameRequest } from "./frame";

type PointerResizeState =
  | { phase: "idle" }
  | {
      phase: "dragging";
      pointerId: number;
      splitId: string;
      index: number;
      direction: "horizontal" | "vertical";
      startX: number;
      startY: number;
      startSizes: number[];
      ownerDocument: Document | null;
      captureTarget: PointerCaptureTarget | null;
      pendingDeltaPx: number;
      pendingFrame: FrameRequest | null;
    };

type PointerCaptureTarget = Element & {
  setPointerCapture?: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
  releasePointerCapture?: (pointerId: number) => void;
};

export class PointerResizeController {
  private state: PointerResizeState = { phase: "idle" };
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
    if (!split) return;

    this.state = {
      phase: "dragging",
      pointerId: event.pointerId,
      splitId: handle.splitId,
      index: handle.index,
      startX: event.clientX,
      startY: event.clientY,
      direction: split.direction,
      startSizes: [...split.sizes],
      ownerDocument,
      captureTarget: pointerCaptureTarget,
      pendingDeltaPx: 0,
      pendingFrame: null,
    };

    this.setPointerCapture(pointerCaptureTarget, event.pointerId);
    this.addDocumentListeners(ownerDocument);
  }

  updateResize(event: PointerEvent): void {
    if (this.state.phase !== "dragging" || this.state.pointerId !== event.pointerId) {
      return;
    }

    if (!findSplitNode(this.controller.getState().root, this.state.splitId)) {
      return;
    }

    const deltaPx =
      this.state.direction === "horizontal"
        ? event.clientX - this.state.startX
        : event.clientY - this.state.startY;

    if (this.state.pendingFrame) {
      this.state = { ...this.state, pendingDeltaPx: deltaPx };
      return;
    }

    const pendingFrame = requestFrame(() => {
      if (this.state.phase !== "dragging") return;
      this.state = { ...this.state, pendingFrame: null };
      this.dispatchPendingResize();
    });
    this.state = { ...this.state, pendingDeltaPx: deltaPx, pendingFrame };
  }

  endResize(event: PointerEvent): void {
    if (this.state.phase !== "dragging" || this.state.pointerId !== event.pointerId) {
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
    if (this.state.phase !== "dragging") {
      return;
    }

    const { captureTarget, ownerDocument, pointerId } = this.state;

    this.removeDocumentListeners(ownerDocument);
    this.releasePointerCapture(captureTarget, pointerId);
    this.state = { phase: "idle" };
  }

  private flushPendingFrame(): void {
    if (this.state.phase !== "dragging" || !this.state.pendingFrame) {
      return;
    }

    cancelFrame(this.state.pendingFrame);
    this.state = { ...this.state, pendingFrame: null };
    this.dispatchPendingResize();
  }

  private dispatchPendingResize(): void {
    if (this.state.phase !== "dragging") {
      return;
    }

    if (!findSplitNode(this.controller.getState().root, this.state.splitId)) {
      return;
    }

    this.controller.api.resizeHandle(this.state.splitId, {
      index: this.state.index,
      deltaPx: this.state.pendingDeltaPx,
      snapshotSizes: this.state.startSizes,
    });
  }

  private cancelPendingFrame(): void {
    if (this.state.phase !== "dragging" || !this.state.pendingFrame) {
      return;
    }

    cancelFrame(this.state.pendingFrame);
    this.state = { ...this.state, pendingFrame: null };
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
