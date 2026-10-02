---
"@andrewcyuan/focusgrid": patch
---

Use zero-specificity `:where(...)` CSS defaults so ordinary consumer class selectors override them regardless of stylesheet order, including active, hover, and focus-visible states. Add `--focusgrid-handle-idle-color` for the idle divider background, preserving its transparent default.
