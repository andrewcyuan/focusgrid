import { defaultPaneShortcutActions } from "@focusgrid/core";

const shortcutStorageKey = "focusgrid.playground.shortcuts";

export function loadSavedShortcuts(): Record<string, string> {
  const defaults = createDefaultShortcuts();

  try {
    const saved = window.localStorage.getItem(shortcutStorageKey);

    if (!saved) {
      return defaults;
    }

    const parsed: unknown = JSON.parse(saved);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaults;
    }

    return defaultPaneShortcutActions.reduce<Record<string, string>>(
      (shortcuts, action) => {
        const value = (parsed as Record<string, unknown>)[action.id];
        shortcuts[action.id] =
          typeof value === "string"
            ? migrateSavedShortcutSyntax(value)
            : action.defaultSequence;
        return shortcuts;
      },
      {},
    );
  } catch {
    return defaults;
  }
}

export function saveShortcuts(shortcuts: Record<string, string>): void {
  try {
    window.localStorage.setItem(shortcutStorageKey, JSON.stringify(shortcuts));
  } catch {
    // The playground should keep working when storage is unavailable.
  }
}

function createDefaultShortcuts(): Record<string, string> {
  return Object.fromEntries(
    defaultPaneShortcutActions.map((action) => [
      action.id,
      action.defaultSequence,
    ]),
  );
}

function migrateSavedShortcutSyntax(sequence: string): string {
  return sequence
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((stroke) => {
      if (!stroke.includes("+")) {
        return stroke;
      }

      const parts = stroke.split("+");
      const key = parts.at(-1);
      const modifiers = parts.slice(0, -1);

      if (!key || modifiers.length === 0 || !modifiers.every(isKeyModifier)) {
        return stroke;
      }

      return [...modifiers, key].join("-");
    })
    .join(" ");
}

function isKeyModifier(input: string): boolean {
  const modifier = input.toLowerCase();
  return (
    modifier === "ctrl" ||
    modifier === "control" ||
    modifier === "mod" ||
    modifier === "meta" ||
    modifier === "cmd" ||
    modifier === "alt" ||
    modifier === "option" ||
    modifier === "shift"
  );
}
