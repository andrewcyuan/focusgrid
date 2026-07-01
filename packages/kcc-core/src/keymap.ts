import {
  validateKeySequenceInput,
  type KeySequence,
  type ShortcutBinding,
} from "@focusgrid/shortcut-engine";
import type {
  KCActionContext,
  KCItemAction,
  KCMoveDirection,
  KCOrientation,
} from "./controller";

export type KCCommandName = "moveActive" | "activate" | "edit";

export type KCCommandAction =
  | KCCommandName
  | {
      command: KCCommandName;
      args?: KCCommandArgs;
    };

export type KCCommandArgs =
  | {
      direction: KCMoveDirection;
      count?: number;
    }
  | undefined;

export type KCShortcutContext = {
  activeItemId: string | null;
  activeIndex: number;
  itemCount: number;
  itemIds: readonly string[];
  focused: boolean;
  orientation: KCOrientation;
};

export type KCActionBinding<T> = {
  sequence: KeySequence | string;
  action: KCItemAction<T> | KCCommandAction;
  command?: KCCommandName;
  preventDefault?: boolean;
  repeat?: boolean;
};

export type KCResolvedAction<T> =
  | {
      kind: "command";
      command: KCCommandName;
      args?: KCCommandArgs;
    }
  | {
      kind: "cell";
      action: KCItemAction<T>;
      command?: KCCommandName;
    };

export type KCKeyBinding<T> = ShortcutBinding<
  KCShortcutContext,
  string,
  KCResolvedAction<T>
>;

export type KCDefaultShortcutAction = {
  id: string;
  label: string;
  defaultSequence: string;
  action: KCCommandAction;
  repeat?: boolean;
};

export const defaultKCShortcutActions = [
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
] as const satisfies readonly KCDefaultShortcutAction[];

export type KCShortcutId = (typeof defaultKCShortcutActions)[number]["id"];
export type KCShortcutOverrides = Partial<Record<KCShortcutId, string>>;
export type KCShortcutValues = Record<KCShortcutId, string>;

export function createDefaultKCShortcuts(): KCShortcutValues {
  return Object.fromEntries(
    defaultKCShortcutActions.map((action) => [
      action.id,
      action.defaultSequence,
    ])
  ) as KCShortcutValues;
}

export function createDefaultKCCollectionKeymap<T>(
  options: {
    overrides?: KCShortcutOverrides;
  } = {}
): KCActionBinding<T>[] {
  const shortcuts = options.overrides ?? {};

  return defaultKCShortcutActions.flatMap((action) => {
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

export function resolveKCKeymap<T>(
  bindings: readonly KCActionBinding<T>[]
): KCKeyBinding<T>[] {
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
        action: `kc.action.${index}`,
        args: resolveAction(binding.action, binding.command),
        preventDefault: binding.preventDefault ?? true,
        repeat: binding.repeat,
      },
    ];
  });
}

function resolveAction<T>(
  action: KCItemAction<T> | KCCommandAction,
  command?: KCCommandName
): KCResolvedAction<T> {
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

function getDefaultCommand(
  action: KCDefaultShortcutAction
): KCCommandName | undefined {
  if (action.id === "activate" || action.id === "edit") {
    return action.id;
  }

  return undefined;
}

function validateSequence(sequence: string): KeySequence | null {
  const validation = validateKeySequenceInput(sequence);

  return validation.ok ? validation.sequence : null;
}
