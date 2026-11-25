import { useState } from "react";
import { createDefaultPaneShortcuts } from "@andrewcyuan/focusgrid/react";
import { loadKeybinds, parseKeybinds, saveKeybinds } from "./keybinds";

const format = (value: unknown) => JSON.stringify(value, null, 2);

export function KeybindsPage() {
  const [text, setText] = useState(() => format(loadKeybinds()));
  const [status, setStatus] = useState("");

  const save = () => {
    try {
      const keybinds = parseKeybinds(text);
      saveKeybinds(keybinds);
      setText(format(keybinds));
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const reset = () => {
    saveKeybinds(null);
    setText(format(createDefaultPaneShortcuts()));
    setStatus("Reset to defaults.");
  };

  return (
    <main className="keybinds-page">
      <p>
        Edit the JSON, then save. Use <code>-</code> between keys in a chord and a space between strokes, for example{" "}
        <code>"Ctrl-S |"</code>.
      </p>
      <textarea
        aria-label="Keybinds JSON"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="actions">
        <button onClick={save}>Save</button>
        <button onClick={reset}>Reset to defaults</button>
        <output role="status">{status}</output>
      </div>
    </main>
  );
}
