# Focusgrid

This is a web library with react bindings to make keyboard native interfaces in the web.

## Code practices

- Always check before adding dependencies. This is a library so dependencies should be kept at a minimum
- Write tests in the test/ folder in each package. Heavily emphasize regression testing to make sure that bugs don't come back, since DOM / focus capture in the browser can be quite flaky. Assert where focus is. The goal of this library is to make focus deterministic enough to become the main mode of driving the app.

## Debugging DOM and keyboard regressions

- Reproduce focus bugs in a real browser when possible. Unit tests are useful for pure normalization and routing logic, but focus, text entry, event phases, default browser behavior, and modifier keys need an end-to-end browser test.
- Make the failing test model the user's actual interaction. For keyboard bugs, focus the exact editable element, set the caret/selection, press the real key sequence, and assert both the intended app state and the textarea/input value. This catches cases where a shortcut command runs but the browser still edits text.
- When a keyboard shortcut fails, separate the problem into layers:
  - event delivery: did the listener see the keydown at all?
  - event phase: did it run before the focused input handled the event?
  - normalization: did the browser event become the same key stroke that the keymap parser produced?
  - routing: did the trie stay in the expected pending state?
  - command execution: did the matched command mutate workspace state?
- Instrument browser events temporarily inside the end-to-end test. Add capture and bubble listeners that record `key`, `code`, modifier flags, target tag, and `defaultPrevented`. This makes it obvious whether a key was swallowed, allowed through, normalized incorrectly, or reset a pending sequence.
- Be careful with modifier-only keydown events. Browsers fire `keydown` for `Shift`, `Control`, `Alt`, and `Meta` before the modified key. A multi-stroke router should usually ignore those standalone modifier events so pressing `Shift+5` after a pending prefix does not reset the sequence before `5` arrives.
- Normalize shifted printable keys deliberately. Browser automation and real browsers may report `Shift+5` as `key: "5"` with `shiftKey: true`, while a human-authored binding may be `"%"`
  . Test both the pure normalizer and the browser interaction.
- Prefer capture-phase listeners for global workspace shortcuts that must run before focused inputs. If the contract says textboxes cannot swallow workspace shortcuts, the DOM layer should observe `keydown` in capture phase and call `preventDefault()`/`stopPropagation()` for pending and matched shortcuts.
- Keep temporary diagnostics out of the final tree. Remove console logs, browser event dumps, screenshots, traces, and generated `test-results` artifacts after the regression test passes.
