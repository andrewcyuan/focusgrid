# API

Shortcut Engine APIs live in `@focusgrid/shortcut-engine`.

```ts
import {
  KeyRouter,
  normalizeKeyboardEvent,
  parseKeySequence,
  routeKeyboardEvent,
} from "@focusgrid/shortcut-engine";
```

## Shared Types

```ts
type KeyStroke = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

type KeySequence = KeyStroke[];

type ShortcutBinding<
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

type ShortcutMatchResult<TAction extends string = string, TArgs = unknown> =
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
```

`preventDefault` defaults to `true` for matched bindings. For unmatched results,
`preventDefault: true` means the router consumed a pending sequence and the DOM
event should usually be stopped.

## `parseKeySequence(input)`

```ts
parseKeySequence(input: string): KeySequence;
```

Parses a shortcut string into a `KeySequence`. Use `-` between modifiers and
keys, and spaces between strokes.

```ts
parseKeySequence("Ctrl-B C");
parseKeySequence("Meta-Shift-P");
```

Invalid strokes throw an error.

## `parseKeyStroke(input)`

```ts
parseKeyStroke(input: string): KeyStroke;
```

Parses one stroke. Modifiers can be `Ctrl`, `Control`, `Mod`, `Meta`, `Cmd`,
`Alt`, `Option`, or `Shift`.

## `normalizeKeySequenceInput(input)`

```ts
normalizeKeySequenceInput(input: string): string;
```

Normalizes editable user input to canonical shortcut syntax when possible.

```ts
normalizeKeySequenceInput("Ctrl+B Shift+Left");
// "Ctrl-B Shift-Left"
```

## `validateKeySequenceInput(input)`

```ts
validateKeySequenceInput(input: string): KeySequenceValidationResult;
```

Validates editable user input without throwing.

```ts
type KeySequenceValidationResult =
  | {
      ok: true;
      sequence: KeySequence;
      value: string;
    }
  | {
      ok: false;
      error: string;
    };
```

## `createKeyStroke(input)`

```ts
createKeyStroke(input: Partial<KeyStroke> & { key: string }): KeyStroke;
```

Creates a normalized `KeyStroke`. Omitted modifiers default to `false`.

## `normalizeKeyName(key)`

```ts
normalizeKeyName(key: string): string;
```

Normalizes key names and aliases. For example, `ArrowRight` becomes `right`,
`Esc` becomes `escape`, and printable letters become lowercase.

## `strokeToId(stroke)`

```ts
strokeToId(stroke: KeyStroke): string;
```

Serializes a key stroke into the internal trie id using modifier order
`ctrl`, `meta`, `alt`, `shift`.

## `new KeyRouter(bindings, options?)`

```ts
new KeyRouter<TContext, TAction, TArgs>(
  bindings: ShortcutBinding<TContext, TAction, TArgs>[],
  options?: {
    repeatTimeoutMs?: number;
    now?: () => number;
  },
): KeyRouter<TContext, TAction, TArgs>;
```

Creates a stateful router for a keymap. The router tracks pending multi-stroke
sequences and optional repeatable leaders.

## `router.handle(stroke, ctx)`

```ts
handle(stroke: KeyStroke, ctx: TContext): ShortcutMatchResult<TAction, TArgs>;
```

Routes one normalized key stroke against the current router state. The context
is passed to each binding's optional `when` predicate.

## `router.reset()`

```ts
reset(): void;
```

Clears pending sequence and repeat state.

## `createTrie(bindings)`

```ts
createTrie<TContext, TAction, TArgs>(
  bindings: ShortcutBinding<TContext, TAction, TArgs>[],
): KeyTrieNode<TContext, TAction, TArgs>;
```

Builds the trie used by `KeyRouter`. Most apps should use `KeyRouter` instead
of calling this directly.

## `normalizeKeyboardEvent(event)`

```ts
normalizeKeyboardEvent(event: KeyboardEvent): KeyStroke;
```

Normalizes a browser `KeyboardEvent` into a `KeyStroke`. Shifted printable keys
are normalized to the produced symbol, so `Shift+5` becomes `%` instead of
`Shift-5`.

## `isModifierOnlyKey(key)`

```ts
isModifierOnlyKey(key: string): boolean;
```

Returns `true` for standalone modifier key names such as `Shift`, `Control`,
`Alt`, `AltGraph`, and `Meta`.

## `routeKeyboardEvent(event, router, options)`

```ts
type KeyboardEventRouteOptions<
  TContext = unknown,
  TAction extends string = string,
  TArgs = unknown,
> = {
  context: TContext;
  ignoreEvent?: (event: KeyboardEvent) => boolean;
  onMatch?: (
    match: Extract<ShortcutMatchResult<TAction, TArgs>, { matched: true }>,
    event: KeyboardEvent,
  ) => void;
};

routeKeyboardEvent<TContext, TAction, TArgs>(
  event: KeyboardEvent,
  router: KeyRouter<TContext, TAction, TArgs>,
  options: KeyboardEventRouteOptions<TContext, TAction, TArgs>,
): ShortcutMatchResult<TAction, TArgs> | null;
```

Routes a browser keyboard event through a `KeyRouter`.

It returns `null` when `ignoreEvent` returns `true` or the event is a
modifier-only keydown. Otherwise it returns the router result.

For routed events, it calls `event.preventDefault()` and
`event.stopPropagation()` when:

- a sequence is pending.
- an invalid continuation consumed a pending sequence.
- a matched binding has `preventDefault` set to `true` or omitted.

When a binding matches, `onMatch` receives the matched result and the original
event after the prevent / stop policy has been applied.

