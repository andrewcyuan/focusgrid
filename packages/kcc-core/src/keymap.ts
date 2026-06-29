import {
  validateKeySequenceInput,
  type KeySequence,
  type ShortcutBinding,
} from "@focusgrid/shortcut-engine";
import type {
  KCLCellAction,
  KCLCellContext,
  KCLMoveDirection,
  KCLOrientation,
} from "./controller";

export type KCLCommandName = "moveActive" | "activate" | "edit";

export type KCLCommandAction =
  | KCLCommandName
  | {
      command: KCLCommandName;
      args?: KCLCommandArgs;
    };

export type KCLCommandArgs =
  | {
      direction: KCLMoveDirection;
      count?: number;
    }
  | undefined;

export type KCLShortcutContext = {
  activeIndex: number;
  itemCount: number;
  focused: boolean;
  orientation: KCLOrientation;
};

export type KCLActionBinding<T> = {
  sequence: KeySequence | string;
  action: KCLCellAction<T> | KCLCommandAction;
  command?: KCLCommandName;
  preventDefault?: boolean;
  repeat?: boolean;
};

export type KCLResolvedAction<T> =
  | {
      kind: "command";
      command: KCLCommandName;
      args?: KCLCommandArgs;
    }
  | {
      kind: "cell";
      action: KCLCellAction<T>;
      command?: KCLCommandName;
    };

export type KCLKeyBinding<T> = ShortcutBinding<
  KCLShortcutContext,
  string,
  KCLResolvedAction<T>
>;

export type KCLDefaultShortcutAction = {
  id: string;
  label: string;
  defaultSequence: string;
  action: KCLCommandAction;
  repeat?: boolean;
};

export const defaultKCLShortcutActions = [
  {
    id: "move-up",
    label: "Move up",
    defaultSequence: "Up",
    action: {
      command: "moveActive",
      args: { direction: "up" },
    },
    repeat: true,
  },
  {
    id: "move-down",
    label: "Move down",
    defaultSequence: "Down",
    action: {
      command: "moveActive",
      args: { direction: "down" },
    },
    repeat: true,
  },
  {
    id: "move-left",
    label: "Move left",
    defaultSequence: "Left",
    action: {
      command: "moveActive",
      args: { direction: "left" },
    },
    repeat: true,
  },
  {
    id: "move-right",
    label: "Move right",
    defaultSequence: "Right",
    action: {
      command: "moveActive",
      args: { direction: "right" },
    },
    repeat: true,
  },
  {
    id: "move-start",
    label: "Move to start",
    defaultSequence: "Home",
    action: {
      command: "moveActive",
      args: { direction: "start" },
    },
  },
  {
    id: "move-end",
    label: "Move to end",
    defaultSequence: "End",
    action: {
      command: "moveActive",
      args: { direction: "end" },
    },
  },
  {
    id: "activate",
    label: "Activate row",
    defaultSequence: "Space",
    action: "activate",
  },
  {
    id: "edit",
    label: "Edit row",
    defaultSequence: "Enter",
    action: "edit",
  },
] as const satisfies readonly KCLDefaultShortcutAction[];

export type KCLShortcutId = (typeof defaultKCLShortcutActions)[number]["id"];
export type KCLShortcutOverrides = Partial<Record<KCLShortcutId, string>>;
export type KCLShortcutValues = Record<KCLShortcutId, string>;

export function createDefaultKCLShortcuts(): KCLShortcutValues {
  return Object.fromEntries(
    defaultKCLShortcutActions.map((action) => [
      action.id,
      action.defaultSequence,
    ]),
  ) as KCLShortcutValues;
}

export function createDefaultKCLKeymap<T>(
  options: {
    overrides?: KCLShortcutOverrides;
    onActivate?: KCLCellAction<T>;
    onEdit?: KCLCellAction<T>;
  } = {},
): KCLActionBinding<T>[] {
  const shortcuts = options.overrides ?? {};

  return defaultKCLShortcutActions.flatMap((action) => {
    const sequence = (shortcuts[action.id] ?? action.defaultSequence).trim();

    if (!sequence) {
      return [];
    }

    const resolvedAction = resolveDefaultAction(action, options);

    return [
      {
        sequence,
        action: resolvedAction,
        command: getDefaultCommand(action),
        repeat: "repeat" in action ? action.repeat : undefined,
      },
    ];
  });
}

export function resolveKCLKeymap<T>(
  bindings: readonly KCLActionBinding<T>[],
): KCLKeyBinding<T>[] {
  return bindings.flatMap((binding, index) => {
    const sequence =
      typeof binding.sequence === "string"
        ? validateSequence(binding.sequence)
        : binding.sequence;

    if (!sequence || sequence.length === 0) {
      return [];
    }

    return [
      {
        sequence,
        action: `kcl.action.${index}`,
        args: resolveAction(binding.action, binding.command),
        preventDefault: binding.preventDefault ?? true,
        repeat: binding.repeat,
      },
    ];
  });
}

export function createKCLCellContext<T>(
  state: KCLShortcutContext,
  dataList: readonly T[],
): KCLCellContext<T> | null {
  const data = dataList[state.activeIndex];

  if (state.activeIndex < 0 || data === undefined) {
    return null;
  }

  return {
    index: state.activeIndex,
    data,
    isListFocused: state.focused,
    isCellActive: true,
  };
}

function resolveAction<T>(
  action: KCLCellAction<T> | KCLCommandAction,
  command?: KCLCommandName,
): KCLResolvedAction<T> {
  if (typeof action === "function") {
    return {
      kind: "cell",
      action,
      command,
    };
  }

  if (typeof action === "string") {
    return {
      kind: "command",
      command: action,
    };
  }

  return {
    kind: "command",
    command: action.command,
    args: action.args,
  };
}

function resolveDefaultAction<T>(
  action: KCLDefaultShortcutAction,
  options: {
    onActivate?: KCLCellAction<T>;
    onEdit?: KCLCellAction<T>;
  },
): KCLCellAction<T> | KCLCommandAction {
  if (action.id === "activate" && options.onActivate) {
    return options.onActivate;
  }

  if (action.id === "edit" && options.onEdit) {
    return options.onEdit;
  }

  return action.action;
}

function getDefaultCommand(
  action: KCLDefaultShortcutAction,
): KCLCommandName | undefined {
  if (action.id === "activate" || action.id === "edit") {
    return action.id;
  }

  return undefined;
}

function validateSequence(sequence: string): KeySequence | null {
  const validation = validateKeySequenceInput(sequence);

  return validation.ok ? validation.sequence : null;
}
