import {
  DEFAULT_PANE_RESIZE_DELTA_PX,
  KeyRouter,
  createKeyStroke,
  type KeyBinding,
  type KeyStroke,
  type PaneResizeDirection,
  type Workspace,
} from "@focusgrid/core";
import { isEditableTarget } from "./focus";
import { cancelFrame, requestFrame, type FrameRequest } from "./frame";

export type KeyboardListenerOptions = {
  keymap?: KeyBinding[];
  mode?: "normal" | "insert" | "resize";
};

export class KeyboardListener {
  private readonly router: KeyRouter;
  private readonly mode: "normal" | "insert" | "resize";
  private mounted = false;
  private pendingResizeFrame: FrameRequest | null = null;
  private readonly pendingResizeCommands = new Map<
    string,
    { paneId: string; direction: PaneResizeDirection; deltaPx: number }
  >();
  private readonly onKey = (event: KeyboardEvent) => {
    if (isModifierOnlyKey(event.key)) {
      return;
    }

    const stroke = normalizeKeyboardEvent(event);
    const result = this.router.handle(stroke, {
      activePaneId: this.workspace.getState().activePaneId,
      inputFocused: isEditableTarget(event.target),
      mode: this.mode,
    });

    if (!result.matched) {
      if (result.pending || result.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }

      return;
    }

    if (result.preventDefault) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.scheduleResizeCommand(result.command, result.args)) {
      return;
    }

    this.workspace.commands.run(result.command, this.workspace, result.args);
  };

  constructor(
    private readonly workspace: Workspace,
    private readonly rootEl: HTMLElement,
    options: KeyboardListenerOptions = {},
  ) {
    this.router = new KeyRouter(options.keymap ?? []);
    this.mode = options.mode ?? "normal";
  }

  mount(): void {
    if (this.mounted) {
      return;
    }

    this.rootEl.addEventListener("keydown", this.onKey, { capture: true });
    this.mounted = true;
  }

  destroy(): void {
    this.rootEl.removeEventListener("keydown", this.onKey, { capture: true });
    this.cancelPendingResizeFrame();
    this.mounted = false;
  }

  private scheduleResizeCommand(command: string, args: unknown): boolean {
    const direction = PANE_RESIZE_COMMAND_DIRECTIONS[command];

    if (!direction) {
      return false;
    }

    const paneId = this.workspace.getState().activePaneId;

    if (!paneId) {
      return true;
    }

    const key = `${paneId}:${direction}`;
    const pending = this.pendingResizeCommands.get(key);
    const deltaPx = getResizeDeltaPx(args);

    if (pending) {
      pending.deltaPx += deltaPx;
    } else {
      this.pendingResizeCommands.set(key, {
        paneId,
        direction,
        deltaPx,
      });
    }

    if (this.pendingResizeFrame) {
      return true;
    }

    this.pendingResizeFrame = requestFrame(() => {
      this.pendingResizeFrame = null;
      const commands = [...this.pendingResizeCommands.values()];
      this.pendingResizeCommands.clear();

      for (const resize of commands) {
        this.workspace.dispatch({
          type: "pane.resize",
          paneId: resize.paneId,
          direction: resize.direction,
          deltaPx: resize.deltaPx,
        });
      }
    });

    return true;
  }

  private cancelPendingResizeFrame(): void {
    if (!this.pendingResizeFrame) {
      return;
    }

    cancelFrame(this.pendingResizeFrame);
    this.pendingResizeFrame = null;
    this.pendingResizeCommands.clear();
  }
}

const PANE_RESIZE_COMMAND_DIRECTIONS: Record<
  string,
  PaneResizeDirection | undefined
> = {
  "pane.resizeLeft": "left",
  "pane.resizeRight": "right",
  "pane.resizeUp": "up",
  "pane.resizeDown": "down",
};

function getResizeDeltaPx(args: unknown): number {
  if (
    typeof args === "object" &&
    args !== null &&
    "deltaPx" in args &&
    typeof args.deltaPx === "number"
  ) {
    return args.deltaPx;
  }

  return DEFAULT_PANE_RESIZE_DELTA_PX;
}

export function normalizeKeyboardEvent(event: KeyboardEvent): KeyStroke {
  const key = normalizeEventKey(event);

  return createKeyStroke({
    key,
    ctrl: event.ctrlKey,
    meta: event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey && !isShiftProducedSymbol(key),
  });
}

function normalizeEventKey(event: KeyboardEvent): string {
  if (event.shiftKey && event.key.length === 1) {
    return SHIFTED_KEY_BY_BASE_KEY[event.key] ?? event.key;
  }

  return event.key;
}

function isShiftProducedSymbol(key: string): boolean {
  return key.length === 1 && key.toLowerCase() === key.toUpperCase();
}

const SHIFTED_KEY_BY_BASE_KEY: Record<string, string> = {
  "`": "~",
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": "\"",
  ",": "<",
  ".": ">",
  "/": "?",
};

function isModifierOnlyKey(key: string): boolean {
  return (
    key === "Alt" ||
    key === "AltGraph" ||
    key === "Control" ||
    key === "Meta" ||
    key === "Shift"
  );
}
