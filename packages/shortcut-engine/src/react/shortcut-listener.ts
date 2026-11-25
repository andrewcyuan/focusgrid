import type { ShortcutEngine } from "../engine";

type Mount = { engine: ShortcutEngine; consumers: number; dispose: () => void };

const mounts = new WeakMap<Document, Mount>();

export function mountShortcutListener(engine: ShortcutEngine, document: Document, rootScopeId: string): () => void {
  const mount = mounts.get(document) ?? createMount(engine, document, rootScopeId);
  if (mount.engine !== engine) throw new Error("Use one shortcut engine per document");
  mount.consumers++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--mount.consumers === 0) mount.dispose();
  };
}

function createMount(engine: ShortcutEngine, document: Document, rootScopeId: string): Mount {
  const activate = (path: EventTarget[]) => {
    const scope = path.find((target) => (target as Element).hasAttribute?.("data-shortcut-scope")) as
      | Element
      | undefined;
    engine.setActiveScope(scope?.getAttribute("data-shortcut-scope") ?? rootScopeId);
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
  document.addEventListener(
    "keydown",
    (event) => {
      activate(event.composedPath());
      engine.handle(event);
    },
    options,
  );
  document.addEventListener("focusin", (event) => activate(event.composedPath()), options);
  document.addEventListener("focusout", (event) => activateElement(event.relatedTarget as Element | null), options);
  document.defaultView?.addEventListener("blur", () => engine.setActiveScope(null), options);
  document.defaultView?.addEventListener("focus", refresh, options);
  const mount: Mount = {
    engine,
    consumers: 0,
    dispose: () => {
      abort.abort();
      mounts.delete(document);
      engine.setActiveScope(null);
    },
  };
  mounts.set(document, mount);
  refresh();
  return mount;
}
