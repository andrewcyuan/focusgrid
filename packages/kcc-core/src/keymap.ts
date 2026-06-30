import {
  validateKeySequenceInput,
  type KeySequence,
  type ShortcutBinding,
} from "@focusgrid/shortcut-engine";
import type {
  KCActionContext,
  KCItemAction,
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
  activeItemId: string | null;
  activeIndex: number;
  itemCount: number;
  itemIds: readonly string[];
  focused: boolean;
  orientation: KCLOrientation;
};

export type KCActionBinding<T> = {
  sequence: KeySequence | string;
  action: KCItemAction<T> | KCLCellAction<T> | KCLCommandAction;
  command?: KCLCommandName;
  preventDefault?: boolean;
  repeat?: boolean;
};

export type KCLActionBinding<T> = KCActionBinding<T>;

export type KCLResolvedAction<T> =
  | {
      kind: "command";
      command: KCLCommandName;
      args?: KCLCommandArgs;
    }
  | {
      kind: "cell";
      action: KCItemAction<T> | KCLCellAction<T>;
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

    const validation = validateKeySequenceInput(sequence);

    if (!validation.ok) {
      return [];
    }

    const resolvedAction = resolveDefaultAction(action, options);

    return [
      {
        sequence: validation.sequence,
        action: resolvedAction,
        command: getDefaultCommand(action),
        repeat: "repeat" in action ? action.repeat : undefined,
      },
    ];
  });
}

export function createDefaultKCCollectionKeymap<T>(
  options: {
    overrides?: KCLShortcutOverrides;
  } = {},
): KCActionBinding<T>[] {
  const shortcuts = options.overrides ?? {};

  return defaultKCLShortcutActions.flatMap((action) => {
    if (action.id === "activate" || action.id === "edit") {
      return [];
    }

    const sequence = (shortcuts[action.id] ?? action.defaultSequence).trim();

    if (!sequence) {
      return [];
    }

    const validation = validateKeySequenceInput(sequence);

    if (!validation.ok) {
      return [];
    }

    return [
      {
        sequence: validation.sequence,
        action: action.action,
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
  indexOrDataList: number | readonly T[],
  data?: T,
): KCLCellContext<T> | null {
  if (typeof indexOrDataList !== "number") {
    const dataList = indexOrDataList;
    const activeData = dataList[state.activeIndex];

    if (state.activeIndex < 0 || activeData === undefined) {
      return null;
    }

    return createKCLCellContext(state, state.activeIndex, activeData);
  }

  const index = indexOrDataList;

  if (index < 0 || data === undefined) {
    return null;
  }

  const id = state.itemIds?.[index] ?? `item-${index}`;

  return {
    id,
    index,
    data,
    isCollectionFocused: state.focused,
    isItemActive: state.activeItemId === id,
    isListFocused: state.focused,
    isCellActive: state.activeItemId === id,
  };
}

function resolveAction<T>(
  action: KCItemAction<T> | KCLCellAction<T> | KCLCommandAction,
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

export type KCActionContextFor<T> = KCActionContext<T>;

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
