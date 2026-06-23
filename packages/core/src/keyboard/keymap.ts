import type { PaneId } from "../state";

export type KeyStroke = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

export type KeySequence = KeyStroke[];

export type ShortcutContext = {
  activePaneId: PaneId | null;
  activePaneType?: string;
  inputFocused: boolean;
  mode: "normal" | "insert" | "resize";
};

export type KeyBinding = {
  sequence: KeySequence;
  command: string;
  args?: unknown;
  when?: (ctx: ShortcutContext) => boolean;
  preventDefault?: boolean;
};

export type KeyMatchResult =
  | {
      matched: false;
      pending: boolean;
    }
  | {
      matched: true;
      pending: false;
      command: string;
      args?: unknown;
      preventDefault: boolean;
    };
