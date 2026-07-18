import { useCallback, useMemo, type KeyboardEventHandler } from "react";
import {
  KeyRouter,
  routeKeyboardEvent,
  validateKeySequenceInput,
  type ShortcutBinding,
  type ShortcutMatchResult,
} from "@focusgrid/shortcut-engine";

export type CompositeShortcutMatch<
  TContext = undefined,
  TAction extends string = string,
  TArgs = unknown,
> = {
  event: KeyboardEvent;
  context: TContext;
  result: Extract<ShortcutMatchResult<TAction, TArgs>, { matched: true }>;
  action: TAction;
  args?: TArgs;
};

export type CompositeShortcutRouterOptions<
  TContext = undefined,
  TAction extends string = string,
  TArgs = unknown,
> = {
  keymap: readonly ShortcutBinding<TContext, TAction, TArgs>[];
  context?: TContext;
  getContext?: () => TContext;
  onMatch: (match: CompositeShortcutMatch<TContext, TAction, TArgs>) => void;
  enabled?: boolean;
  ignoreEvent?: (event: KeyboardEvent) => boolean;
  resetOnIgnore?: boolean;
};

export type CompositeShortcutRouterResult<
  TElement extends HTMLElement = HTMLElement,
> = {
  onKeyDownCapture: KeyboardEventHandler<TElement>;
  compositeProps: {
    "data-focusgrid-composite": "";
    onKeyDownCapture: KeyboardEventHandler<TElement>;
  };
};

export function useCompositeShortcutRouter<
  TContext = undefined,
  TAction extends string = string,
  TArgs = unknown,
  TElement extends HTMLElement = HTMLElement,
>(
  options: CompositeShortcutRouterOptions<TContext, TAction, TArgs>,
): CompositeShortcutRouterResult<TElement> {
  const {
    context,
    enabled = true,
    getContext,
    ignoreEvent,
    keymap,
    onMatch,
    resetOnIgnore = true,
  } = options;

  const router = useMemo(() => new KeyRouter([...keymap]), [keymap]);

  const onKeyDownCapture = useCallback<KeyboardEventHandler<TElement>>(
    (event) => {
      const nativeEvent = event.nativeEvent;

      if (!enabled) {
        router.reset();
        return;
      }

      const shouldIgnore =
        nativeEvent.defaultPrevented ||
        isEditableEventTarget(nativeEvent.target) ||
        (ignoreEvent?.(nativeEvent) ?? false);

      if (shouldIgnore) {
        if (resetOnIgnore) {
          router.reset();
        }

        return;
      }

      const resolvedContext = getContext ? getContext() : (context as TContext);

      routeKeyboardEvent(nativeEvent, router, {
        context: resolvedContext,
        onMatch: (result, matchedEvent) => {
          onMatch({
            event: matchedEvent,
            context: resolvedContext,
            result,
            action: result.action,
            args: result.args,
          });
        },
      });
    },
    [context, enabled, getContext, ignoreEvent, onMatch, resetOnIgnore, router],
  );

  const compositeProps = useMemo(
    () => ({
      "data-focusgrid-composite": "" as const,
      onKeyDownCapture,
    }),
    [onKeyDownCapture],
  );

  return {
    onKeyDownCapture,
    compositeProps,
  };
}

export type CompositeNavigationDirection =
  | "left"
  | "right"
  | "up"
  | "down"
  | "start"
  | "end";

export type CompositeNavigationShortcutId = `move-${CompositeNavigationDirection}`;

export type CompositeNavigationShortcutArgs = {
  direction: CompositeNavigationDirection;
};

export type CompositeNavigationShortcutDefinition = {
  id: CompositeNavigationShortcutId;
  label: string;
  defaultSequence: string;
  action: CompositeNavigationShortcutId;
  args: CompositeNavigationShortcutArgs;
  repeat?: boolean;
};

export type CompositeNavigationShortcutOverrides = Partial<
  Record<CompositeNavigationShortcutId, string>
>;

export type CompositeNavigationShortcutValues = Record<
  CompositeNavigationShortcutId,
  string
>;

export const defaultCompositeNavigationShortcutActions = [
  navigationShortcut("move-left", "Move left", "Left", "left", true),
  navigationShortcut("move-right", "Move right", "Right", "right", true),
  navigationShortcut("move-up", "Move up", "Up", "up", true),
  navigationShortcut("move-down", "Move down", "Down", "down", true),
  navigationShortcut("move-start", "Move to start", "Home", "start"),
  navigationShortcut("move-end", "Move to end", "End", "end"),
] as const satisfies readonly CompositeNavigationShortcutDefinition[];

export function createDefaultCompositeNavigationShortcuts(): CompositeNavigationShortcutValues {
  return Object.fromEntries(
    defaultCompositeNavigationShortcutActions.map((shortcut) => [
      shortcut.id,
      shortcut.defaultSequence,
    ]),
  ) as CompositeNavigationShortcutValues;
}

export function normalizeCompositeNavigationShortcutOverrides(
  overrides: CompositeNavigationShortcutOverrides,
): Partial<CompositeNavigationShortcutValues> {
  const normalized: Partial<CompositeNavigationShortcutValues> = {};

  for (const shortcut of defaultCompositeNavigationShortcutActions) {
    const value = overrides[shortcut.id];

    if (value === undefined) {
      continue;
    }

    const validation = validateKeySequenceInput(value);

    if (validation.ok && validation.sequence.length > 0) {
      normalized[shortcut.id] = validation.value;
    }
  }

  return normalized;
}

export function createCompositeNavigationKeymap<TContext = unknown>(
  options: {
    overrides?: CompositeNavigationShortcutOverrides;
    when?: (ctx: TContext) => boolean;
  } = {},
): ShortcutBinding<
  TContext,
  CompositeNavigationShortcutId,
  CompositeNavigationShortcutArgs
>[] {
  const overrides = options.overrides ?? {};

  return defaultCompositeNavigationShortcutActions.flatMap((shortcut) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(
      overrides,
      shortcut.id,
    );
    const input = hasOverride
      ? overrides[shortcut.id]
      : shortcut.defaultSequence;

    if (!input) {
      return [];
    }

    const validation = validateKeySequenceInput(input);

    if (!validation.ok || validation.sequence.length === 0) {
      return [];
    }

    return [
      {
        sequence: validation.sequence,
        action: shortcut.action,
        args: shortcut.args,
        repeat: shortcut.repeat,
        when: options.when,
      },
    ];
  });
}

function navigationShortcut(
  id: CompositeNavigationShortcutId,
  label: string,
  defaultSequence: string,
  direction: CompositeNavigationDirection,
  repeat?: boolean,
): CompositeNavigationShortcutDefinition {
  return {
    id,
    label,
    defaultSequence,
    action: id,
    args: { direction },
    repeat,
  };
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  const element = target as {
    tagName?: string;
    isContentEditable?: boolean;
    type?: string;
    readOnly?: boolean;
    disabled?: boolean;
    getAttribute?: (name: string) => string | null;
  };

  if (element.isContentEditable) {
    return true;
  }

  const tagName = element.tagName?.toLowerCase();

  if (tagName === "textarea" || tagName === "select") {
    return !element.disabled;
  }

  if (tagName === "input") {
    const type = element.type?.toLowerCase() ?? "text";
    return (
      !element.disabled &&
      !element.readOnly &&
      editableInputTypes.has(type)
    );
  }

  return element.getAttribute?.("role") === "textbox";
}

const editableInputTypes = new Set([
  "date",
  "datetime-local",
  "email",
  "file",
  "month",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "time",
  "url",
  "week",
]);
