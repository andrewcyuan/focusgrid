import { normalizeShortcut } from "@andrewcyuan/shortcut-engine";
import {
  createDefaultPaneShortcuts,
  defaultPaneShortcutActions,
  type PaneShortcutId,
  type PaneShortcutValues,
} from "@andrewcyuan/focusgrid/react";

const storageKey = "focusgrid-demo-keybinds";

export function loadKeybinds(): PaneShortcutValues {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return parseKeybinds(saved);
  } catch {}
  return createDefaultPaneShortcuts();
}

export function saveKeybinds(keybinds: PaneShortcutValues | null) {
  try {
    if (keybinds) localStorage.setItem(storageKey, JSON.stringify(keybinds));
    else localStorage.removeItem(storageKey);
  } catch {}
}

export function parseKeybinds(json: string): PaneShortcutValues {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Keybinds must be a JSON object.");
  }
  const keybinds = createDefaultPaneShortcuts();
  for (const [id, sequence] of Object.entries(parsed)) {
    if (!(id in keybinds)) throw new Error(`Unknown action "${id}".`);
    if (typeof sequence !== "string") throw new Error(`"${id}" must be a string.`);
    normalizeShortcut(sequence);
    keybinds[id as PaneShortcutId] = sequence;
  }
  return keybinds;
}

export function actionLabel(id: PaneShortcutId): string {
  return defaultPaneShortcutActions.find((action) => action.id === id)!.label;
}
