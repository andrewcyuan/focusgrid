# API

Ariakit Adapter APIs live in `@focusgrid/ariakit-adapter` and
`@focusgrid/ariakit-adapter/react`.

```ts
import {
  createCompositeNavigationKeymap,
  useCompositeShortcutRouter,
} from "@focusgrid/ariakit-adapter/react";
```

## `useCompositeShortcutRouter(options)`

```ts
function useCompositeShortcutRouter<
  TContext = undefined,
  TAction extends string = string,
  TArgs = unknown,
  TElement extends HTMLElement = HTMLElement,
>(
  options: CompositeShortcutRouterOptions<TContext, TAction, TArgs>,
): CompositeShortcutRouterResult<TElement>;
```

Creates a stable `KeyRouter` for a React component and returns props for an
Ariakit `Composite` root.

```ts
type CompositeShortcutRouterOptions<
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

type CompositeShortcutRouterResult<
  TElement extends HTMLElement = HTMLElement,
> = {
  onKeyDownCapture: KeyboardEventHandler<TElement>;
  compositeProps: {
    "data-focusgrid-composite": "";
    onKeyDownCapture: KeyboardEventHandler<TElement>;
  };
};
```

`keymap` uses `ShortcutBinding` from `@focusgrid/shortcut-engine`. The hook
routes DOM events with `routeKeyboardEvent()`, so multi-stroke bindings,
shifted printable keys, modifier-only keydowns, repeatable two-stroke bindings,
and prevent / stop behavior match the rest of Focusgrid.

Pass either `context` or `getContext`. `getContext` is useful when the matching
handler needs the latest app state at the moment of the keydown.

`enabled` defaults to `true`. When disabled, the hook resets router state and
does not route the event.

`resetOnIgnore` defaults to `true`. Ignored events reset pending multi-stroke
state unless this option is set to `false`.

## Match payload

```ts
type CompositeShortcutMatch<
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
```

`onMatch` receives the original keyboard event, the resolved context, the full
Shortcut Engine match result, and convenience `action` / `args` fields.

The event has already gone through the standard prevent / stop policy before
`onMatch` runs.

## Default ignore behavior

The hook ignores these events by default:

- events with `defaultPrevented: true`.
- events from enabled, writable text-like inputs.
- events from enabled `textarea` and `select` elements.
- events from `contenteditable` elements.
- events from elements with `role="textbox"`.
- events ignored by the optional `ignoreEvent` callback.

Checkboxes, radios, buttons, and readonly/disabled inputs are not considered
editable by the default policy.

## Navigation definitions

```ts
const defaultCompositeNavigationShortcutActions: readonly CompositeNavigationShortcutDefinition[];
```

The default definitions are:

```ts
type CompositeNavigationShortcutId =
  | "move-left"
  | "move-right"
  | "move-up"
  | "move-down"
  | "move-start"
  | "move-end";

type CompositeNavigationDirection =
  | "left"
  | "right"
  | "up"
  | "down"
  | "start"
  | "end";

type CompositeNavigationShortcutDefinition = {
  id: CompositeNavigationShortcutId;
  label: string;
  defaultSequence: string;
  action: CompositeNavigationShortcutId;
  args: {
    direction: CompositeNavigationDirection;
  };
  repeat?: boolean;
};
```

Arrow movement bindings are repeatable. Start/end bindings are not repeatable.

## `createDefaultCompositeNavigationShortcuts()`

```ts
function createDefaultCompositeNavigationShortcuts(): CompositeNavigationShortcutValues;
```

Returns the default shortcut values as a record keyed by
`CompositeNavigationShortcutId`.

## `normalizeCompositeNavigationShortcutOverrides(overrides)`

```ts
function normalizeCompositeNavigationShortcutOverrides(
  overrides: CompositeNavigationShortcutOverrides,
): Partial<CompositeNavigationShortcutValues>;
```

Normalizes valid override strings to canonical shortcut syntax and omits empty
or invalid overrides.

```ts
normalizeCompositeNavigationShortcutOverrides({
  "move-down": "Ctrl+J",
  "move-up": "",
});
// { "move-down": "Ctrl-J" }
```

## `createCompositeNavigationKeymap(options?)`

```ts
function createCompositeNavigationKeymap<TContext = unknown>(
  options?: {
    overrides?: CompositeNavigationShortcutOverrides;
    when?: (ctx: TContext) => boolean;
  },
): ShortcutBinding<
  TContext,
  CompositeNavigationShortcutId,
  CompositeNavigationShortcutArgs
>[];
```

Creates Shortcut Engine bindings for the default composite navigation actions.

Overrides replace the default sequence for an action. Empty or invalid override
values omit that action from the returned keymap.

Use `when` to scope all generated navigation bindings to app state:

```ts
const keymap = createCompositeNavigationKeymap({
  when: (ctx: { mode: "list" | "detail" }) => ctx.mode === "list",
});
```
