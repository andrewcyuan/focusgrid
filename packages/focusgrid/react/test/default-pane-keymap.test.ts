import { describe, expect, it } from "vitest";
import { FocusGridController } from "@andrewcyuan/focusgrid/core";
import { FocusGridDomController } from "@andrewcyuan/focusgrid/dom";
import { createDefaultPaneKeymap, createDefaultPaneShortcuts, defaultPaneShortcutActions } from "../src/index";

function controller() {
  return new FocusGridController(
    {
      root: {
        kind: "split",
        id: "root",
        orientation: "horizontal",
        sizes: [1, 1],
        children: [
          { kind: "pane", id: "left-node", paneId: "left" },
          { kind: "pane", id: "right-node", paneId: "right" },
        ],
      },
      activePaneId: "left",
      container: { width: 1000, height: 600 },
    },
    new FocusGridDomController(),
  );
}

const event = {} as KeyboardEvent;

describe("default pane keymap", () => {
  it("creates default shortcut values from the exported actions", () => {
    expect(createDefaultPaneShortcuts()).toEqual(
      Object.fromEntries(defaultPaneShortcutActions.map((action) => [action.id, action.defaultSequence])),
    );
  });

  it("creates callback bindings that act on the current active pane", () => {
    const grid = controller();
    const keymap = createDefaultPaneKeymap(grid);
    expect(keymap).toHaveLength(defaultPaneShortcutActions.length);
    const resize = keymap.find((binding) => binding.sequence === "Ctrl-Shift-L")!;
    expect(resize.repeat).toBe(true);
    resize.action(event);
    expect(grid.getLayout().panes[0]!.rect.width).toBeGreaterThan(500);
    grid.focus("right");
    keymap.find((binding) => binding.sequence === "Ctrl-S |")!.action(event);
    expect(grid.getLayout().panes).toHaveLength(3);
  });

  it("uses custom sequences in place of the defaults", () => {
    const grid = controller();
    const keymap = createDefaultPaneKeymap(grid, { ...createDefaultPaneShortcuts(), "split-down": "Ctrl-K D" });
    expect(keymap.some((binding) => binding.sequence === "Ctrl-S -")).toBe(false);
    keymap.find((binding) => binding.sequence === "Ctrl-K D")!.action(event);
    expect(grid.getLayout().panes).toHaveLength(3);
  });
});
