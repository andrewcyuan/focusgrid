import type { ShortcutEngine } from "@andrewcyuan/shortcut-engine";

const mounts = new WeakMap<Document, { engine: ShortcutEngine; cleanup: () => void }>();

/** Scope elements use data-shortcut-scope; ancestry stays in the engine. */
export function mountShortcutListener(engine: ShortcutEngine, document: Document): () => void {
  const existing = mounts.get(document);
  if (existing) {
    if (existing.engine !== engine) throw new Error("Use one shortcut engine per document");
    return existing.cleanup;
  }
  const activate = (path: EventTarget[]) => {
    const scope = path.find(target => (target as Element).hasAttribute?.("data-shortcut-scope")) as Element | undefined;
    engine.setActiveScope(scope?.getAttribute("data-shortcut-scope") ?? null);
  };
  const activateElement = (element: Element | null) => {
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    const path: Element[] = [];
    while (element) {
      path.push(element);
      element = element.parentElement ?? (element.getRootNode() as ShadowRoot).host ?? null;
    }
    activate(path);
  };
  const refresh = () => activateElement(document.activeElement);
  const abort = new AbortController();
  const options = { capture: true, signal: abort.signal };
  document.addEventListener("keydown", event => {
    activate(event.composedPath());
    engine.handle(event);
  }, options);
  document.addEventListener("focusin", event => activate(event.composedPath()), options);
  document.addEventListener("focusout", event => activateElement(event.relatedTarget as Element | null), options);
  document.defaultView?.addEventListener("blur", () => engine.setActiveScope(null), options);
  document.defaultView?.addEventListener("focus", refresh, options);
  const cleanup = () => {
    if (abort.signal.aborted) return;
    abort.abort();
    mounts.delete(document);
    engine.setActiveScope(null);
  };
  mounts.set(document, { engine, cleanup });
  refresh();
  return cleanup;
}
