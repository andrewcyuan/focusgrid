import { ShortcutProvider } from "@andrewcyuan/focusgrid/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@andrewcyuan/focusgrid/react/styles.css";
import "../../../tokens.css";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <ShortcutProvider><App /></ShortcutProvider>
  </StrictMode>,
);
