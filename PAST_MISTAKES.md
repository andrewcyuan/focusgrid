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
