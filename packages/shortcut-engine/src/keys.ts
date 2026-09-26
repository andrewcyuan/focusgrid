const modifiers = ["ctrl", "cmd", "alt", "shift"] as const;
const shifted: Record<string, string> = Object.fromEntries(
  [..."`1234567890-=[]\\;',./"].map((key, index) => [key, '~!@#$%^&*()_+{}|:"<>?'[index]!]),
);

export function normalizeShortcut(sequence: string): string {
  if (!sequence.trim()) throw new Error("Shortcut sequences must not be empty");
  return sequence.trim().split(/\s+/).map(stroke => {
    let key = stroke.toLowerCase();
    const held = new Set<string>();
    let prefix: RegExpMatchArray | null;
    while ((prefix = key.match(/^(ctrl|cmd|alt|shift)-/))) {
      held.add(prefix[1]!);
      key = key.slice(prefix[0].length);
    }
    if (!key || (key.length !== 1 && !/^[a-z][a-z0-9]*$/.test(key)) || modifiers.some(modifier => modifier === key)) {
      throw new Error(`Invalid shortcut: ${stroke}`);
    }
    if (held.has("shift") && key.length === 1) {
      key = shifted[key] ?? key;
      if (key.toLowerCase() === key.toUpperCase()) held.delete("shift");
    }
    return [...modifiers.filter(modifier => held.has(modifier)), key].join("-");
  }).join(" ");
}

export function normalizeKeyboardEvent(event: KeyboardEvent): string | null {
  if (["Shift", "Control", "Alt", "Meta", "AltGraph"].includes(event.key)) return null;
  const key = event.key === " " ? "space" : event.key.replace(/^Arrow/, "");
  const held = [event.ctrlKey, event.metaKey, event.altKey, event.shiftKey];
  return normalizeShortcut([...modifiers.filter((_, index) => held[index]), key].join("-"));
}
