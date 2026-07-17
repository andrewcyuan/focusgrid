# Past Mistakes

## Missing Cursor Values Are Not Clampable Cursor Values

- **Mistake:** During the KCC id-based controller refactor, an absent `activeIndex` was normalized through `clampActiveIndex(-1, itemCount)`, which silently became `0` and masked `selectDefaultIndex`.
- **Impact:** Controllers with a default selection callback initialized the first item instead of the requested default.
- **Fix pattern:** Treat omitted cursor options as `null`/unprovided before clamping. Only clamp an index after confirming the caller actually supplied one.
- **Regression coverage:** Keep a controller initialization test that provides `selectDefaultIndex` without `activeIndex` and asserts the derived `activeItemId`.

## Nested Resize Handles Must Refit Descendant Splits

- **Mistake:** `resizeHandle` clamped only the two immediate children of the target split. When one child was itself a same-axis split, shrinking that nested split could leave its internal pane ratios stale. A descendant pane near `minWidth`/`minHeight` then appeared to block the outer handle, even when another descendant pane still had room to shrink.
- **Impact:** Dragging the handle between a nested split and an adjacent pane could fail to move, or could preserve invalid descendant sizes, especially after one pane in the nested split was much smaller than its sibling.
- **Fix pattern:** Parent split resizing must refit same-axis descendant splits against the newly allocated axis size, honoring descendant minimum sizes and internal handle sizes.
- **Regression coverage:** Keep a core test where a horizontal root contains a horizontal nested split plus an outside pane, the nested split has one child near minimum size, and dragging the root handle toward the nested split still grows the outside pane while preserving the pinned child minimum.

## Public Controller State Must Be Validated At Boundaries

- **Mistake:** Public controller creation and deserialize paths trusted caller-provided layout trees, so non-binary splits, duplicate IDs, stale active pane IDs, legacy capability fields, and unknown structural fields could enter core state.
- **Impact:** Layout, focus memory, and command routing could behave differently from library-created state and bugs could hide in direct fixtures that core would never generate itself.
- **Fix pattern:** Validate public state before accepting it, return structured validation errors, and throw a typed exception from creation/deserialization boundaries.
- **Regression coverage:** Keep core validation tests for invalid tree shape, duplicate IDs, missing active panes, non-binary splits, bad sizes, bad capability fields, legacy `no*` fields, and pane-specific error metadata.

## DOM Mount Lifecycles Must Be Idempotent

- **Mistake:** `FocusGridDomController.mount()` always created new keyboard listeners and resize observers, and repeated lifecycle calls could double-register global behavior.
- **Impact:** Re-mounted controllers could handle a single keydown or resize more than once, making focus and layout changes look flaky.
- **Fix pattern:** Track mounted state in DOM adapters and make repeated `mount()`/`destroy()` calls no-ops after the first effective transition.
- **Regression coverage:** Keep a DOM lifecycle test that calls `mount()` and `destroy()` twice and asserts only one listener/observer registration and cleanup.
