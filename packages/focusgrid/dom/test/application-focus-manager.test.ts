import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFocusGridController,
  type FocusGridControllerState,
} from "@focusgrid/focusgrid/core";
import {
  ApplicationFocusManager,
  isUnownedFocus,
} from "../src/application-focus-manager";
import {
  hasInteractiveOwner,
  isTabbableElement,
  shouldFocusPaneShellForPointer,
} from "../src/interactivity";

type Listener = (event: Event) => void;

class FakeElement {
  parentElement: FakeHTMLElement | null = null;
}

class FakeHTMLElement extends FakeElement {
  readonly children: FakeHTMLElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<Listener>>();
  className = "";
  disabled = false;
  hidden = false;
  inert = false;
  isContentEditable = false;
  isConnected = true;
  focusFails = false;
  styleDisplay = "block";
  styleVisibility = "visible";
  tabIndex: number;

  constructor(
    readonly tagName: string,
    readonly ownerDocument: FakeDocument,
  ) {
    super();
    this.tabIndex = ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(tagName)
      ? 0
      : -1;
  }

  append(...children: FakeHTMLElement[]): this {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
    return this;
  }

  remove(): void {
    if (this.parentElement) {
      const index = this.parentElement.children.indexOf(this);
      if (index >= 0) this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
    this.isConnected = false;
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as Listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener as Listener);
  }

  emit(type: string, input: Record<string, unknown> = {}): void {
    const event = { type, target: this, button: 0, ...input } as unknown as Event;
    let current: FakeHTMLElement | null = this;
    while (current) {
      for (const listener of current.listeners.get(type) ?? []) listener(event);
      current = current.parentElement;
    }
  }

  contains(target: unknown): boolean {
    if (target === this) return true;
    return this.children.some((child) => child.contains(target));
  }

  closest(selector: string): FakeHTMLElement | null {
    let current: FakeHTMLElement | null = this;
    while (current) {
      if (selector === ".FocusgridPaneView" && current.hasClass(selector.slice(1))) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  querySelectorAll(selector: string): FakeHTMLElement[] {
    const matches: FakeHTMLElement[] = [];
    const visit = (element: FakeHTMLElement): void => {
      for (const child of element.children) {
        if (
          (selector === ".FocusgridPaneView" && child.hasClass("FocusgridPaneView")) ||
          (selector !== ".FocusgridPaneView" && isCandidate(child))
        ) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  focus(): void {
    if (this.focusFails) return;
    this.ownerDocument.activeElement = this;
    this.emit("focusin");
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name.toLowerCase(), value);
    if (name.toLowerCase() === "tabindex") this.tabIndex = Number(value);
    if (name.toLowerCase() === "contenteditable") this.isContentEditable = value !== "false";
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name.toLowerCase());
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name.toLowerCase()) ?? null;
  }

  private hasClass(name: string): boolean {
    return this.className.split(/\s+/).includes(name);
  }
}

class FakeWindow {
  readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as Listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener as Listener);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ type, target: this } as unknown as Event);
    }
  }

  setTimeout = globalThis.setTimeout.bind(globalThis);
  clearTimeout = globalThis.clearTimeout.bind(globalThis);
  getComputedStyle(element: FakeHTMLElement): CSSStyleDeclaration {
    return {
      display: element.styleDisplay,
      visibility: element.styleVisibility,
    } as CSSStyleDeclaration;
  }
}

class FakeDocument {
  readonly defaultView = new FakeWindow();
  readonly documentElement = new FakeHTMLElement("HTML", this);
  readonly body = new FakeHTMLElement("BODY", this);
  activeElement: FakeHTMLElement | null = this.body;

  constructor() {
    this.documentElement.append(this.body);
  }
}

function isCandidate(element: FakeHTMLElement): boolean {
  const tag = element.tagName.toLowerCase();
  return (
    ["button", "input", "select", "textarea"].includes(tag) ||
    (tag === "a" && element.hasAttribute("href")) ||
    element.hasAttribute("contenteditable") ||
    element.hasAttribute("tabindex")
  );
}

function controllerState(): FocusGridControllerState {
  return {
    root: {
      kind: "split",
      id: "root",
      direction: "horizontal",
      sizes: [0.5, 0.5],
      children: [
        { kind: "pane", id: "left-node", paneId: "left" },
        { kind: "pane", id: "right-node", paneId: "right" },
      ],
    },
    activePaneId: "left",
    container: { width: 800, height: 600 },
  };
}

function fixture() {
  const document = new FakeDocument();
  const scope = new FakeHTMLElement("DIV", document);
  const header = new FakeHTMLElement("HEADER", document);
  const root = new FakeHTMLElement("DIV", document);
  const left = pane(document, "left");
  const right = pane(document, "right");
  const leftFirst = new FakeHTMLElement("BUTTON", document);
  const leftSecond = new FakeHTMLElement("BUTTON", document);
  const rightFirst = new FakeHTMLElement("BUTTON", document);
  const rightSecond = new FakeHTMLElement("BUTTON", document);
  left.append(leftFirst, leftSecond);
  right.append(rightFirst, rightSecond);
  root.append(left, right);
  scope.append(header, root);
  document.body.append(scope);
  const controller = createFocusGridController(controllerState());
  const manager = new ApplicationFocusManager(
    controller,
    root as unknown as HTMLElement,
    scope as unknown as HTMLElement,
  );
  return {
    controller,
    document,
    header,
    left,
    leftFirst,
    leftSecond,
    manager,
    right,
    rightFirst,
    rightSecond,
    root,
    scope,
  };
}

function pane(document: FakeDocument, paneId: string): FakeHTMLElement {
  const paneElement = new FakeHTMLElement("DIV", document);
  paneElement.className = "FocusgridPaneView";
  paneElement.dataset.paneId = paneId;
  paneElement.tabIndex = -1;
  return paneElement;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Element", FakeElement);
  vi.stubGlobal("HTMLElement", FakeHTMLElement);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ApplicationFocusManager", () => {
  it("installs and removes every listener and subscription idempotently", () => {
    const f = fixture();
    const subscribe = vi.spyOn(f.controller, "subscribe");

    f.manager.mount();
    f.manager.mount();

    expect(f.root.listeners.get("focusin")?.size).toBe(1);
    expect(f.scope.listeners.get("pointerdown")?.size).toBe(1);
    expect(f.document.defaultView.listeners.get("focus")?.size).toBe(1);
    expect(subscribe).toHaveBeenCalledTimes(1);

    f.manager.destroy();
    f.manager.destroy();

    expect(f.root.listeners.get("focusin")?.size).toBe(0);
    expect(f.scope.listeners.get("pointerdown")?.size).toBe(0);
    expect(f.document.defaultView.listeners.get("focus")?.size).toBe(0);
  });

  it("remembers descendants per pane and restores them on pane changes", () => {
    const f = fixture();
    f.manager.mount();
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(f.leftFirst);

    f.leftSecond.focus();
    f.controller.api.focus("right");
    expect(f.document.activeElement).toBe(f.rightFirst);
    f.rightSecond.focus();

    f.controller.api.focus("left");
    expect(f.document.activeElement).toBe(f.leftSecond);
    f.controller.api.focus("right");
    expect(f.document.activeElement).toBe(f.rightSecond);
  });

  it("updates logical pane focus from focusin", () => {
    const f = fixture();
    f.manager.mount();
    f.rightSecond.focus();
    expect(f.controller.getState().activePaneId).toBe("right");
  });

  it("drops disconnected memory and falls back to the first tabbable descendant", () => {
    const f = fixture();
    f.manager.mount();
    vi.runOnlyPendingTimers();
    f.leftSecond.focus();
    f.leftSecond.remove();
    f.document.activeElement = f.document.body;
    f.controller.api.focus("right");
    f.controller.api.focus("left");
    expect(f.document.activeElement).toBe(f.leftFirst);
  });

  it("skips disabled, hidden, inert, and negative-tabindex fallback targets", () => {
    const f = fixture();
    f.leftFirst.disabled = true;
    f.leftSecond.setAttribute("tabindex", "-1");
    const hidden = new FakeHTMLElement("BUTTON", f.document);
    hidden.hidden = true;
    const inertParent = new FakeHTMLElement("DIV", f.document);
    inertParent.setAttribute("inert", "");
    const inertButton = new FakeHTMLElement("BUTTON", f.document);
    inertParent.append(inertButton);
    f.left.append(hidden, inertParent);
    f.manager.mount();
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(f.left);
  });

  it("continues through the fallback order when a focus request fails", () => {
    const f = fixture();
    f.leftFirst.focusFails = true;
    f.manager.mount();
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(f.leftSecond);
  });

  it("preserves external interactive controls during pane changes", () => {
    const f = fixture();
    const input = new FakeHTMLElement("INPUT", f.document);
    f.scope.append(input);
    f.manager.mount();
    input.focus();
    f.controller.api.focus("right");
    expect(f.document.activeElement).toBe(input);
  });

  it("restores after static scope clicks but ignores grid and interactive clicks", () => {
    const f = fixture();
    const link = new FakeHTMLElement("A", f.document);
    link.setAttribute("href", "/");
    f.header.append(link);
    f.manager.mount();
    vi.runOnlyPendingTimers();

    f.header.emit("pointerdown");
    f.document.activeElement = f.document.body;
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(f.leftFirst);

    f.document.activeElement = f.document.body;
    f.left.emit("pointerdown");
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(f.document.body);

    link.focus();
    link.emit("pointerdown");
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(link);

    f.header.emit("pointerdown");
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(f.leftFirst);
  });

  it("restores unowned focus on window focus and preserves interactive focus", () => {
    const f = fixture();
    const button = new FakeHTMLElement("BUTTON", f.document);
    f.scope.append(button);
    f.manager.mount();
    vi.runOnlyPendingTimers();

    f.document.activeElement = f.document.body;
    f.document.defaultView.emit("focus");
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(f.leftFirst);

    button.focus();
    f.document.defaultView.emit("focus");
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(button);
  });

  it("cancels deferred restoration when destroyed", () => {
    const f = fixture();
    f.manager.mount();
    f.manager.destroy();
    vi.runOnlyPendingTimers();
    expect(f.document.activeElement).toBe(f.document.body);
  });
});

describe("application focus classification", () => {
  it("recognizes supported tabbable elements and rejects unavailable targets", () => {
    const document = new FakeDocument();
    const link = new FakeHTMLElement("A", document);
    link.setAttribute("href", "/");
    link.tabIndex = 0;
    expect(isTabbableElement(link as unknown as HTMLElement)).toBe(true);
    link.setAttribute("aria-disabled", "true");
    expect(isTabbableElement(link as unknown as HTMLElement)).toBe(false);
  });

  it.each([
    ["input", "INPUT", undefined],
    ["button", "BUTTON", undefined],
    ["link", "A", "href"],
    ["editable", "DIV", "contenteditable"],
    ["dialog", "DIALOG", undefined],
  ])("preserves an external %s", (_, tagName, attribute) => {
    const document = new FakeDocument();
    const scope = new FakeHTMLElement("DIV", document);
    const target = new FakeHTMLElement(tagName, document);
    if (attribute) target.setAttribute(attribute, attribute === "href" ? "/" : "true");
    scope.append(target);
    expect(hasInteractiveOwner(
      target as unknown as Element,
      scope as unknown as HTMLElement,
    )).toBe(true);
    expect(shouldFocusPaneShellForPointer(
      target as unknown as Element,
      scope as unknown as HTMLElement,
    )).toBe(false);
    expect(isUnownedFocus(
      target as unknown as Element,
      document as unknown as Document,
    )).toBe(false);
  });
});
