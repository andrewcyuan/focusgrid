import type { CSSProperties } from "react";
import { useMemo } from "react";
import type { ComputedHandle } from "@focusgrid/core";
import { PointerResizeController } from "@focusgrid/dom";
import { useWorkspace } from "./hooks";

export type ResizeHandleProps = {
  handle: ComputedHandle;
};

export function ResizeHandle({ handle }: ResizeHandleProps) {
  const workspace = useWorkspace();
  const controller = useMemo(
    () => new PointerResizeController(workspace),
    [workspace],
  );
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
      onPointerDown={(event) => controller.startResize(event.nativeEvent, handle)}
      onPointerMove={(event) => controller.updateResize(event.nativeEvent)}
      onPointerUp={(event) => controller.endResize(event.nativeEvent)}
      onPointerCancel={(event) => controller.endResize(event.nativeEvent)}
    />
  );
}
