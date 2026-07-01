import {
  createDefaultPaneShortcuts,
  defaultPaneShortcutActions,
  type PaneShortcutValues,
} from "@focusgrid/core";
import {
  createDefaultKCShortcuts,
  defaultKCShortcutActions,
  type KCShortcutValues,
} from "@focusgrid/kcc-core";
import { normalizeKeySequenceInput } from "@focusgrid/shortcut-engine";

const shortcutStorageKey = "focusgrid.playground.shortcuts";
const kcShortcutStorageKey = "focusgrid.playground.kc-shortcuts";

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
      { ...defaults }
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

export function loadSavedKCShortcuts(): KCShortcutValues {
  const defaults = createDefaultKCShortcuts();

  try {
    const saved = window.localStorage.getItem(kcShortcutStorageKey);

    if (!saved) {
      return defaults;
    }

    const parsed: unknown = JSON.parse(saved);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaults;
    }

    return defaultKCShortcutActions.reduce<KCShortcutValues>(
      (shortcuts, action) => {
        const value = (parsed as Record<string, unknown>)[action.id];
        shortcuts[action.id] =
          typeof value === "string"
            ? normalizeKeySequenceInput(value)
            : action.defaultSequence;
        return shortcuts;
      },
      { ...defaults }
    );
  } catch {
    return defaults;
  }
}

export function saveKCShortcuts(shortcuts: KCShortcutValues): void {
  try {
    window.localStorage.setItem(
      kcShortcutStorageKey,
      JSON.stringify(shortcuts)
    );
  } catch {
    // The playground should keep working when storage is unavailable.
  }
}
