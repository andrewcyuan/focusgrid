const INTERACTIVE_ROLES = new Set([
  "alertdialog",
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "grid",
  "gridcell",
  "link",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "radiogroup",
  "scrollbar",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "tablist",
  "textbox",
  "toolbar",
  "tree",
  "treegrid",
  "treeitem",
]);

function hasInteractiveOwner(
  target: Element,
  boundary: HTMLElement,
): boolean {
  let element: Element | null = target;

  while (element && element !== boundary) {
    if (element instanceof HTMLElement && isInteractiveElement(element)) return true;
    element = element.parentElement;
  }

  return boundary instanceof HTMLElement && isInteractiveElement(boundary);
}

export function shouldFocusPaneShellForPointer(
  target: Element,
  paneShell: HTMLElement,
): boolean {
  return target === paneShell || !hasInteractiveOwner(target, paneShell);
}

function isInteractiveElement(element: HTMLElement): boolean {
  if (isUnavailableElement(element)) return false;

  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  return (
    element.isContentEditable ||
    element.tabIndex >= 0 ||
    (tagName === "a" && element.hasAttribute("href")) ||
    tagName === "button" ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    tagName === "dialog" ||
    tagName === "summary" ||
    (role !== undefined && INTERACTIVE_ROLES.has(role))
  );
}

function isUnavailableElement(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;

  while (current) {
    if (
      current.hidden ||
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true" ||
      current.getAttribute("aria-disabled") === "true" ||
      ("disabled" in current && Boolean(current.disabled))
    ) {
      return true;
    }

    const view = current.ownerDocument.defaultView;
    if (view) {
      const style = view.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") return true;
    }

    current = current.parentElement;
  }

  return false;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.getAttribute("role")?.toLowerCase() === "textbox") return true;
  if (target.matches("textarea, select")) return !target.matches(":disabled");
  return target instanceof HTMLInputElement && !target.disabled && !target.readOnly &&
    ["date", "datetime-local", "email", "file", "month", "number", "password", "search", "tel", "text", "time", "url", "week"].includes(target.type);
}
