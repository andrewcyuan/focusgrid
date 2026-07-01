import { describe, expect, it, vi } from "vitest";
import {
  createDefaultKCCollectionKeymap,
  createDefaultKCShortcuts,
  createKCActionContext,
  createKCController,
  defaultKCShortcutActions,
  parseKeySequence,
  resolveKCKeymap,
  type KCControllerState,
} from "../src";

describe("KCController", () => {
  it("initializes from item ids", () => {
    expect(createKCController().getState()).toEqual({
      activeItemId: null,
      activeIndex: -1,
      itemCount: 0,
      itemIds: [],
      focused: false,
      orientation: "vertical",
      wrapAround: false,
    });

    expect(
      createKCController({
        itemIds: ["compose", "inbox", "labels"],
        activeItemId: "inbox",
        focused: true,
        orientation: "horizontal",
      }).getState()
    ).toEqual({
      activeItemId: "inbox",
      activeIndex: 1,
      itemCount: 3,
      itemIds: ["compose", "inbox", "labels"],
      focused: true,
      orientation: "horizontal",
      wrapAround: false,
    });
  });

  it("clamps active index writes and notifies only on changes", () => {
    const controller = createKCController({
      itemIds: ["compose", "inbox", "labels"],
    });
    const listener = vi.fn();
    controller.subscribe(listener);

    expect(controller.api.setActiveIndex(10)).toBe(true);
    expect(controller.getState().activeItemId).toBe("labels");
    expect(listener).toHaveBeenCalledTimes(1);

    expect(controller.api.setActiveIndex((index) => index + 1)).toBe(false);
    expect(controller.getState().activeItemId).toBe("labels");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reconciles active items by stable id when entries reorder", () => {
    const controller = createKCController();

    controller.api.setRegisteredEntries([
      { id: "compose", element: null, data: undefined },
      { id: "inbox", element: null, data: undefined },
      { id: "labels", element: null, data: undefined },
    ]);
    controller.api.setActiveItemId("labels");

    controller.api.setRegisteredEntries([
      { id: "labels", element: null, data: undefined },
      { id: "compose", element: null, data: undefined },
      { id: "inbox", element: null, data: undefined },
    ]);

    expect(controller.getState()).toMatchObject({
      activeItemId: "labels",
      activeIndex: 0,
      itemIds: ["labels", "compose", "inbox"],
    });
  });

  it("moves across registered entries and supports wrap-around", () => {
    const controller = createKCController({ wrapAround: true });

    controller.api.setRegisteredEntries([
      { id: "compose", element: null, data: undefined },
      { id: "inbox", element: null, data: undefined },
      { id: "disabled", element: null, data: undefined, disabled: true },
      { id: "labels", element: null, data: undefined },
    ]);

    expect(controller.getState().activeItemId).toBe("compose");
    expect(controller.commands.moveActive("down", 2)).toBe(true);
    expect(controller.getState().activeItemId).toBe("labels");

    expect(controller.commands.moveActive("down")).toBe(true);
    expect(controller.getState().activeItemId).toBe("compose");
  });
});

describe("KC keymaps", () => {
  it("creates typed default shortcut values from the exported actions", () => {
    expect(createDefaultKCShortcuts()).toEqual(
      Object.fromEntries(
        defaultKCShortcutActions.map((action) => [
          action.id,
          action.defaultSequence,
        ])
      )
    );
  });

  it("creates collection movement bindings", () => {
    const resolved = resolveKCKeymap(createDefaultKCCollectionKeymap());

    expect(resolved).toHaveLength(6);
    expect(resolved[0]).toMatchObject({
      sequence: parseKeySequence("Up"),
      args: {
        kind: "command",
        command: "moveActive",
        args: { direction: "up" },
      },
    });
  });

  it("applies movement overrides and omits invalid or empty bindings", () => {
    const resolved = resolveKCKeymap(
      createDefaultKCCollectionKeymap({
        overrides: {
          "move-up": "K",
          "move-down": "",
          "move-left": "Ctrl+",
          "move-right": "L",
          activate: "A",
          edit: "E",
        },
      })
    );

    expect(resolved).toHaveLength(4);
    expect(
      resolved.find((binding) => {
        const action = binding.args;
        return action?.kind === "command" && action.args?.direction === "up";
      })
    ).toMatchObject({
      sequence: parseKeySequence("K"),
    });
    expect(
      resolved.some((binding) => {
        const action = binding.args;
        return (
          action?.kind === "command" &&
          (action.command === "activate" || action.command === "edit")
        );
      })
    ).toBe(false);
  });

  it("creates action contexts for item data", () => {
    const state: KCControllerState = {
      activeItemId: "beta",
      activeIndex: 1,
      itemCount: 2,
      itemIds: ["alpha", "beta"],
      focused: true,
      orientation: "vertical",
      wrapAround: false,
    };

    expect(createKCActionContext(state, "beta", { label: "Beta" })).toEqual({
      id: "beta",
      index: 1,
      data: { label: "Beta" },
      isCollectionFocused: true,
      isItemActive: true,
    });
  });
});
