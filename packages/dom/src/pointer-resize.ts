import {
  findSplitNode,
  type ComputedHandle,
  type Workspace,
} from "@focusgrid/core";
import { cancelFrame, requestFrame, type FrameRequest } from "./frame";

type ResizeDrag = {
  pointerId: number;
  splitId: string;
  index: number;
  startX: number;
  startY: number;
  startSizes: number[];
};

export class PointerResizeController {
  private drag: ResizeDrag | null = null;
  private pendingDeltaPx = 0;
  private pendingFrame: FrameRequest | null = null;

  constructor(private readonly workspace: Workspace) {}

  startResize(event: PointerEvent, handle: ComputedHandle): void {
    event.preventDefault();
    this.cancelPendingFrame();

    const target = event.currentTarget;

    if (target instanceof HTMLElement) {
      target.setPointerCapture(event.pointerId);
    }

    const split = findSplitNode(this.workspace.getState().root, handle.splitId);

    this.drag = {
      pointerId: event.pointerId,
      splitId: handle.splitId,
      index: handle.index,
      startX: event.clientX,
      startY: event.clientY,
      startSizes: split ? [...split.sizes] : [],
    };
  }

  updateResize(event: PointerEvent): void {
    if (!this.drag || this.drag.pointerId !== event.pointerId) {
      return;
    }

    const split = findSplitNode(this.workspace.getState().root, this.drag.splitId);

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

    const target = event.currentTarget;

    if (target instanceof HTMLElement && target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

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

    if (!findSplitNode(this.workspace.getState().root, this.drag.splitId)) {
      return;
    }

    this.workspace.dispatch({
      type: "handle.resize",
      splitId: this.drag.splitId,
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
}
