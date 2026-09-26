import { describe, expect, it, vi } from "vitest";
import { FocusGridController } from "../src";

function controller() {
  return new FocusGridController({
    root: { kind: "pane", id: "editor-node", paneId: "editor" },
    activePaneId: "editor", container: { width: 800, height: 600 },
  }, { focus: () => true });
}

describe("controller pane events", () => {
  it("reports geometry changes from the committed transition", () => {
    const grid = controller();
    const onPaneLayoutChange = vi.fn();
    grid.subscribePaneEvents({ onPaneLayoutChange });
    grid.setContainerSize(600, 600);
    expect(onPaneLayoutChange).toHaveBeenCalledOnce();
    expect(onPaneLayoutChange.mock.calls[0][0]).toMatchObject({
      pane: { paneId: "editor", rect: { width: 600 } },
      previousPane: { paneId: "editor", rect: { width: 800 } }, controller: grid,
    });
  });

  it("reports a pane created and removed before any React render", () => {
    const grid = controller();
    const onPaneClose = vi.fn();
    grid.subscribePaneEvents({ onPaneClose });
    grid.split("editor-node", { side: "right", newPaneId: "terminal" });
    grid.remove("terminal");
    expect(onPaneClose).toHaveBeenCalledOnce();
    expect(onPaneClose.mock.calls[0][0]).toMatchObject({ paneId: "terminal", controller: grid });
  });

  it("ignores focus and capability changes and stops after cleanup", () => {
    const grid = controller();
    grid.split("editor-node", { side: "right", newPaneId: "terminal" });
    const onPaneClose = vi.fn();
    const onPaneLayoutChange = vi.fn();
    const cleanup = grid.subscribePaneEvents({ onPaneClose, onPaneLayoutChange });
    grid.focus("editor");
    grid.updatePane("editor", { canRemove: false });
    expect(onPaneLayoutChange).not.toHaveBeenCalled();
    cleanup();
    grid.remove("terminal");
    expect(onPaneClose).not.toHaveBeenCalled();
    expect(onPaneLayoutChange).not.toHaveBeenCalled();
  });
});
