import { isEditableTarget, parseKeySequence, type ShortcutBinding } from "@andrewcyuan/shortcut-engine";

export type CompositeNavigationDirection = "left" | "right" | "up" | "down" | "start" | "end";

export function createCompositeNavigationKeymap(
  move: (direction: CompositeNavigationDirection, event: KeyboardEvent) => void,
): ShortcutBinding[] {
  const keys: [string, CompositeNavigationDirection][] = [
    ["Left", "left"], ["Right", "right"], ["Up", "up"],
    ["Down", "down"], ["Home", "start"], ["End", "end"],
  ];
  return keys.map(([key, direction]) => ({
    sequence: parseKeySequence(key),
    action: event => move(direction, event),
    when: event => !isEditableTarget(event.target),
  }));
}
