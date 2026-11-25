import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { GridPage } from "./GridPage";
import { KeybindsPage } from "./KeybindsPage";
import "@andrewcyuan/focusgrid/react/styles.css";
import "./styles.css";

function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(location.hash);
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  }, []);
  const page = hash === "#/keybinds" ? "keybinds" : "grid";
  return (
    <>
      <nav>
        <strong>Focusgrid</strong>
        <a href="#/" aria-current={page === "grid" ? "page" : undefined}>
          Grid
        </a>
        <a href="#/keybinds" aria-current={page === "keybinds" ? "page" : undefined}>
          Keybinds
        </a>
      </nav>
      {page === "grid" ? <GridPage /> : <KeybindsPage />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
