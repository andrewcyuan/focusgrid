export type KeyStroke = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

export type KeySequence = KeyStroke[];

export type ShortcutBinding<
  TContext = unknown,
  TAction extends string = string,
  TArgs = unknown,
> = {
  sequence: KeySequence;
  action: TAction;
  args?: TArgs;
  when?: (ctx: TContext) => boolean;
  preventDefault?: boolean;
  repeat?: boolean;
};

export type ShortcutMatchResult<
  TAction extends string = string,
  TArgs = unknown,
> =
  | {
      matched: false;
      pending: boolean;
      preventDefault?: boolean;
    }
  | {
      matched: true;
      pending: false;
      action: TAction;
      args?: TArgs;
      preventDefault: boolean;
    };
