export type FrameRequest =
  | { kind: "animation"; id: number }
  | { kind: "timeout"; id: ReturnType<typeof setTimeout> };

export function requestFrame(callback: () => void): FrameRequest {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return {
      kind: "animation",
      id: globalThis.requestAnimationFrame(() => callback()),
    };
  }

  return {
    kind: "timeout",
    id: globalThis.setTimeout(callback, 0),
  };
}

export function cancelFrame(frame: FrameRequest): void {
  if (frame.kind === "animation") {
    globalThis.cancelAnimationFrame(frame.id);
    return;
  }

  globalThis.clearTimeout(frame.id);
}
