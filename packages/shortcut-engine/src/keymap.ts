export type ShortcutBinding = {
  sequence: string;
  action: (event: KeyboardEvent) => void;
  when?: (event: KeyboardEvent) => boolean;
  preventDefault?: boolean;
  repeat?: boolean;
};
