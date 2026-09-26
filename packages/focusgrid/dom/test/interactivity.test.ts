import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  });
});
