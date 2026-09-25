export type KeyStroke = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

export type KeySequence = KeyStroke[];

export type ShortcutBinding = {
  sequence: KeySequence;
  action: (event: KeyboardEvent) => void;
  when?: (event: KeyboardEvent) => boolean;
  preventDefault?: boolean;
  repeat?: boolean;
};
