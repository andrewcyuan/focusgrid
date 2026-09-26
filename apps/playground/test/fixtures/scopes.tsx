import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import {
  ShortcutProvider, ShortcutScope, useShortcuts, FocusGrid, useFocusGridController,
} from "@andrewcyuan/focusgrid/react";
import { createDefaultPaneKeymap } from "@andrewcyuan/focusgrid/core";
import { type ShortcutBinding } from "@andrewcyuan/shortcut-engine";
import "@andrewcyuan/focusgrid/react/styles.css";

function bind(sequence: string, action: (event: KeyboardEvent) => void): ShortcutBinding {
  return { sequence: sequence, action };
}
function Contributor({ value, report }: { value: string; report: (value: string) => void }) {
  useShortcuts([bind("F2", () => report(value))]);
  return null;
}
function Child({ name, report }: { name: string; report: (value: string) => void }) {
  useShortcuts([
    bind("Ctrl-K A", () => report(`${name}:child-long`)),
    bind("G A", () => report(`${name}:child-a`)),
    bind("F3", () => report(`${name}:child`)),
    bind("Ctrl-B %", () => report(`${name}:split-blocked`)),
    bind("Ctrl-B X", () => report(`${name}:close-blocked`)),
  ]);
  return <textarea aria-label={name} defaultValue="abcdef" />;
}
function Module() {
  const [result, setResult] = useState("none");
  const [version, setVersion] = useState(0);
  const [latest, setLatest] = useState(true);
  const [child, setChild] = useState(true);
  const [grid, setGrid] = useState(true);
  const controller = useFocusGridController(() => ({
    root: { kind: "split", id: "split", direction: "horizontal", sizes: [1, 1], children: [
      { kind: "pane", id: "node-a", paneId: "pane-a" },
      { kind: "pane", id: "node-b", paneId: "pane-b" },
    ] },
    activePaneId: "pane-a", container: { width: 800, height: 300 },
  }));
  useShortcuts([
    bind("Ctrl-K", () => setResult("parent-short")),
    bind("G B", () => setResult(`parent-b:${version}`)),
    bind("F3", () => setResult("parent-f3")),
  ]);
  return <>
    <output aria-label="result">{result}</output>
    <button onClick={() => setVersion(v => v + 1)}>Rerender</button>
    <button onClick={() => setLatest(v => !v)}>Toggle contributor</button>
    <button onClick={() => setChild(v => !v)}>Toggle child</button>
    <button onClick={() => setGrid(v => !v)}>Toggle grid</button>
    <Contributor value={`first:${version}`} report={setResult} />
    {latest && <Contributor value={`latest:${version}`} report={setResult} />}
    <ShortcutScope id="sibling"><Child name="sibling" report={setResult} /></ShortcutScope>
    {grid && <div style={{ height: 300, width: 800 }}>
      <FocusGrid controller={controller} keymap={createDefaultPaneKeymap(controller)} renderPane={({ paneId }) => <>
        <textarea aria-label={`${paneId}-plain`} defaultValue="abcdef" />
        {child && <ShortcutScope id={`${paneId}-child`}><Child name={paneId} report={setResult} /></ShortcutScope>}
      </>} />
    </div>}
    {createPortal(<ShortcutScope id="portal-scope"><Child name="portal" report={setResult} /></ShortcutScope>, document.getElementById("portal")!)}
  </>;
}

function App() {
  const [mounted, setMounted] = useState(true);
  return <>
    <button onClick={() => setMounted(v => !v)}>Toggle module</button>
    <input aria-label="outside" />
    {mounted && <ShortcutScope id="module"><Module /></ShortcutScope>}
  </>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><ShortcutProvider><App /></ShortcutProvider></StrictMode>);
