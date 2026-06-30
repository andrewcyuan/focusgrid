# Usage

`@focusgrid/shortcut-engine` is the shared shortcut layer used by FocusGrid and
KCC. It parses key sequence strings, normalizes key strokes, and routes strokes
through a typed keymap. It does not own focus, ARIA, command registries, or app
state.

## Key Sequences

Shortcut chords use `-` between combined keys and spaces between strokes:

```ts
import { parseKeySequence } from "@focusgrid/shortcut-engine";

parseKeySequence("Ctrl-B L");
parseKeySequence("Meta-Shift-P");
parseKeySequence("Ctrl-B %");
```

The parser normalizes key names and aliases. Arrow keys become plain
directions, `Esc` becomes `escape`, and single printable keys become lowercase.

```ts
parseKeySequence("ArrowRight");
// [{ key: "right", ctrl: false, meta: false, alt: false, shift: false }]
```

Shortcut strings use `-` as the canonical modifier separator. For editable
settings UIs, `normalizeKeySequenceInput()` and `validateKeySequenceInput()`
accept common `+` input and return the canonical form.

```ts
import { validateKeySequenceInput } from "@focusgrid/shortcut-engine";

validateKeySequenceInput("Ctrl+B Shift+Left");
// { ok: true, value: "Ctrl-B Shift-Left", sequence: [...] }
```

## Headless Routing

`KeyRouter` is independent of the DOM. Feed it normalized `KeyStroke` values
and a context object. Bindings can use `when` to opt in only for specific app
state.

```ts
import {
  KeyRouter,
  parseKeySequence,
  type ShortcutBinding,
} from "@focusgrid/shortcut-engine";

type AppContext = {
  mode: "normal" | "editing";
};

type AppAction = "item.open" | "item.delete";

const bindings: ShortcutBinding<AppContext, AppAction>[] = [
  {
    sequence: parseKeySequence("Enter"),
    action: "item.open",
  },
  {
    sequence: parseKeySequence("D"),
    action: "item.delete",
    when: (ctx) => ctx.mode === "normal",
  },
];

const router = new KeyRouter(bindings);

const result = router.handle(parseKeySequence("D")[0]!, {
  mode: "normal",
});

if (result.matched) {
  runAction(result.action, result.args);
}
```

Unmatched continuations after a pending prefix return `preventDefault: true`.
That lets a DOM adapter consume invalid followers such as `Ctrl-B Z` after
`Ctrl-B` started a multi-stroke sequence.

## DOM Routing

For browser keyboard events, use `routeKeyboardEvent()` to share the standard
event flow: ignore modifier-only keydowns, normalize the event, route it, and
apply the pending / matched `preventDefault()` policy.

```ts
import {
  KeyRouter,
  parseKeySequence,
  routeKeyboardEvent,
  type ShortcutBinding,
} from "@focusgrid/shortcut-engine";

type AppAction = "command.open" | "item.rename";

const router = new KeyRouter([
  {
    sequence: parseKeySequence("Ctrl-K"),
    action: "command.open",
  },
  {
    sequence: parseKeySequence("R"),
    action: "item.rename",
    when: (ctx: { editing: boolean }) => !ctx.editing,
  },
] satisfies ShortcutBinding<{ editing: boolean }, AppAction>[]);

root.addEventListener(
  "keydown",
  (event) => {
    routeKeyboardEvent(event, router, {
      context: {
        editing: isEditing(),
      },
      ignoreEvent: (event) => isTextInput(event.target),
      onMatch: (match) => runAction(match.action, match.args),
    });
  },
  { capture: true },
);
```

`ignoreEvent` is app policy. Shortcut Engine does not decide which DOM targets
are editable or focusable because that depends on the component contract.

## Repeatable Leaders

Bindings can opt into tmux-style retained leaders with `repeat: true`. After a
repeatable two-stroke sequence runs, another repeatable follower under the same
leader can run without replaying the leader during the repeat window.

```ts
const router = new KeyRouter(
  [
    {
      sequence: parseKeySequence("Ctrl-B H"),
      action: "resize.left",
      repeat: true,
    },
    {
      sequence: parseKeySequence("Ctrl-B L"),
      action: "resize.right",
      repeat: true,
    },
  ],
  {
    repeatTimeoutMs: 300,
  },
);
```

In this example, `Ctrl-B L H` can run `resize.right` and then `resize.left` if
`H` is pressed before the repeat window expires. Repeat only applies to
two-stroke bindings marked with `repeat: true`.

