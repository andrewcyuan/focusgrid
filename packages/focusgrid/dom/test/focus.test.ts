import { describe, expect, it, vi } from "vitest";
import { FocusGridDomController } from "../src/controller";

function fixture() {
  const document = { activeElement: null as unknown };
  const panes: unknown[] = [];
  const root = { ownerDocument: document, querySelectorAll: () => panes } as unknown as HTMLElement;
  const addPane = (paneId: string, owner = root) => {
    const pane = {
      dataset: { paneId }, closest: () => owner,
      contains: (element: unknown) => element === pane,
      focus: vi.fn(() => { document.activeElement = pane; }),
    };
    panes.push(pane);
    return pane;
  };
  const dom = new FocusGridDomController();
  return { dom, root, document, addPane };
}

describe("DOM focus boundary", () => {
  it("returns false before attachment, after cleanup, and for missing panes", () => {
    const { dom, root } = fixture();
    expect(dom.focus("a")).toBe(false);
    dom.setRoot(root);
    expect(dom.focus("a")).toBe(false);
    dom.setRoot(null);
    expect(dom.focus("a")).toBe(false);
  });

  it("matches literal IDs and excludes panes in nested grids", () => {
    const { dom, root, addPane, document } = fixture();
    const nested = addPane('a"]', {} as HTMLElement);
    const pane = addPane('a"]');
    dom.setRoot(root);
    expect(dom.focus('a"]')).toBe(true);
    expect(document.activeElement).toBe(pane);
    expect(pane.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(nested.focus).not.toHaveBeenCalled();
  });

  it("preserves existing focus and reports failed focus", () => {
    const { dom, root, addPane, document } = fixture();
    const pane = addPane("a");
    dom.setRoot(root);
    document.activeElement = pane;
    expect(dom.focus("a")).toBe(true);
    expect(pane.focus).not.toHaveBeenCalled();
    document.activeElement = null;
    pane.focus.mockImplementation(() => {});
    expect(dom.focus("a")).toBe(false);
  });
});
