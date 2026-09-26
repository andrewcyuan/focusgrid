import type { CSSProperties } from "react";
import type { ComputedHandle } from "@andrewcyuan/focusgrid/core";

export type ResizeHandleProps = {
  handle: ComputedHandle;
};

export function ResizeHandle({ handle }: ResizeHandleProps) {
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
      data-resize-handle={handle.id}
    />
  );
}
