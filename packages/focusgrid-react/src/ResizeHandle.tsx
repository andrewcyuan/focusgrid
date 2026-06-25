import type { CSSProperties } from "react";
import { useEffect, useMemo } from "react";
import type { ComputedHandle, FocusGridController } from "@focusgrid/core";
import { PointerResizeController } from "@focusgrid/dom";

export type ResizeHandleProps = {
  controller: FocusGridController;
  handle: ComputedHandle;
};

export function ResizeHandle({ controller, handle }: ResizeHandleProps) {
  const resizeController = useMemo(
    () => new PointerResizeController(controller),
    [controller],
  );
  useEffect(() => () => resizeController.destroy(), [resizeController]);

  const style: CSSProperties = {
    left: handle.rect.x,
    top: handle.rect.y,
    width: handle.rect.width,
    height: handle.rect.height,
  };

  return (
    <div
      className="FocusgridResizeHandle"
      data-direction={handle.direction}
      style={style}
      role="separator"
      aria-orientation={handle.direction === "horizontal" ? "vertical" : "horizontal"}
      onPointerDown={(event) =>
        resizeController.startResize(
          event.nativeEvent,
          handle,
          event.currentTarget,
        )
      }
    />
  );
}
