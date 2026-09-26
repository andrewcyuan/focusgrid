import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldFocusPaneShellForPointer } from "../src/interactivity";

class ElementStub {
  parentElement: ElementStub | null = null;
  tabIndex = -1;
  hidden = false;
  disabled = false;
  isContentEditable = false;
  attributes = new Map<string, string>();
  ownerDocument = { defaultView: null };
  constructor(readonly tagName: string) {}
  hasAttribute(name: string) { return this.attributes.has(name); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
}

beforeEach(() => {
  vi.stubGlobal("Element", ElementStub);
  vi.stubGlobal("HTMLElement", ElementStub);
});
afterEach(() => vi.unstubAllGlobals());

function shouldFocus(target: ElementStub, pane: ElementStub) {
  return shouldFocusPaneShellForPointer(target as unknown as Element, pane as unknown as HTMLElement);
}

describe("pane pointer focus", () => {
  it.each(["INPUT", "BUTTON", "SELECT", "TEXTAREA", "DIALOG", "SUMMARY"])("preserves an interactive %s", tag => {
    const pane = new ElementStub("DIV");
    const target = new ElementStub(tag);
    target.parentElement = pane;
    expect(shouldFocus(target, pane)).toBe(false);
  });

  it("preserves links, editable content, and interactive ancestors", () => {
    const pane = new ElementStub("DIV");
    const link = new ElementStub("A");
    link.attributes.set("href", "/");
    link.parentElement = pane;
    const child = new ElementStub("SPAN");
    child.parentElement = link;
    expect(shouldFocus(child, pane)).toBe(false);
    const editable = new ElementStub("DIV");
    editable.isContentEditable = true;
    editable.parentElement = pane;
    expect(shouldFocus(editable, pane)).toBe(false);
  });

  it("focuses the shell for static content and unavailable controls", () => {
    const pane = new ElementStub("DIV");
    const staticText = new ElementStub("SPAN");
    staticText.parentElement = pane;
    expect(shouldFocus(staticText, pane)).toBe(true);
    expect(shouldFocus(pane, pane)).toBe(true);
    const button = new ElementStub("BUTTON");
    button.disabled = true;
    button.parentElement = pane;
    expect(shouldFocus(button, pane)).toBe(true);
  });
});
