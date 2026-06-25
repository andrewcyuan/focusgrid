import {
  createDefaultPaneShortcuts,
  defaultPaneShortcutActions,
  type PaneShortcutValues,
} from "@focusgrid/core";
import { normalizeKeySequenceInput } from "@focusgrid/shortcut-engine";

const shortcutStorageKey = "focusgrid.playground.shortcuts";

export function loadSavedShortcuts(): PaneShortcutValues {
  const defaults = createDefaultPaneShortcuts();

  try {
    const saved = window.localStorage.getItem(shortcutStorageKey);

    if (!saved) {
      return defaults;
    }

    const parsed: unknown = JSON.parse(saved);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaults;
    }

    return defaultPaneShortcutActions.reduce<PaneShortcutValues>(
      (shortcuts, action) => {
        const value = (parsed as Record<string, unknown>)[action.id];
        shortcuts[action.id] =
          typeof value === "string"
            ? normalizeKeySequenceInput(value)
            : action.defaultSequence;
        return shortcuts;
      },
      { ...defaults },
    );
  } catch {
    return defaults;
  }
}

export function saveShortcuts(shortcuts: PaneShortcutValues): void {
  try {
    window.localStorage.setItem(shortcutStorageKey, JSON.stringify(shortcuts));
  } catch {
    // The playground should keep working when storage is unavailable.
  }
}
