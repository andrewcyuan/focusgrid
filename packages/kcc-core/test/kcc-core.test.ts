import { describe, expect, it, vi } from "vitest";
import {
  createDefaultKCCollectionKeymap,
  createDefaultKCLKeymap,
  createDefaultKCLShortcuts,
  createKCLCellContext,
  createKCLController,
  defaultKCLShortcutActions,
  parseKeySequence,
  resolveKCLKeymap,
  type KCLControllerState,
} from "../src";

describe("KCLController", () => {
  it("initializes empty and non-empty lists deterministically", () => {
    expect(createKCLController().getState()).toEqual({
      activeItemId: null,
      activeIndex: -1,
      itemCount: 0,
      itemIds: [],
      focused: false,
      orientation: "vertical",
      wrapAround: false,
    });

    expect(
      createKCLController({
        itemCount: 5,
        selectDefaultIndex: () => 2,
        focused: true,
        orientation: "horizontal",
      }).getState(),
    ).toEqual({
      activeItemId: "item-2",
      activeIndex: 2,
      itemCount: 5,
      itemIds: ["item-0", "item-1", "item-2", "item-3", "item-4"],
      focused: true,
      orientation: "horizontal",
      wrapAround: false,
    });
  });

  it("clamps active index writes and notifies only on changes", () => {
    const controller = createKCLController({ itemCount: 3 });
    const listener = vi.fn();
    controller.subscribe(listener);

    expect(controller.api.setActiveIndex(10)).toBe(true);
    expect(controller.getState().activeIndex).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);

    expect(controller.api.setActiveIndex((index) => index + 1)).toBe(false);
    expect(controller.getState().activeIndex).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reconciles active index when item count changes", () => {
    const controller = createKCLController({ itemCount: 5, activeIndex: 4 });

    expect(controller.api.setItemCount(2)).toBe(true);
    expect(controller.getState().activeIndex).toBe(1);

    expect(controller.api.setItemCount(0)).toBe(true);
    expect(controller.getState().activeIndex).toBe(-1);

    expect(controller.api.setItemCount(4, () => 3)).toBe(true);
    expect(controller.getState().activeIndex).toBe(3);
  });

  it("moves vertically and ignores horizontal directions for vertical lists", () => {
    const controller = createKCLController({ itemCount: 4, activeIndex: 1 });

    expect(controller.commands.moveActive("down")).toBe(true);
    expect(controller.getState().activeIndex).toBe(2);

    expect(controller.commands.moveActive("right")).toBe(false);
    expect(controller.getState().activeIndex).toBe(2);

    expect(controller.commands.moveActive("up", 99)).toBe(true);
    expect(controller.getState().activeIndex).toBe(0);
  });

  it("moves horizontally and supports start/end commands", () => {
    const controller = createKCLController({
      itemCount: 4,
      activeIndex: 1,
      orientation: "horizontal",
    });

    expect(controller.commands.moveActive("right", 2)).toBe(true);
    expect(controller.getState().activeIndex).toBe(3);

    expect(controller.commands.moveActive("down")).toBe(false);
    expect(controller.getState().activeIndex).toBe(3);

    expect(controller.commands.moveActive("start")).toBe(true);
    expect(controller.getState().activeIndex).toBe(0);

    expect(controller.commands.moveActive("end")).toBe(true);
    expect(controller.getState().activeIndex).toBe(3);
  });

  it("computes cell contexts from current state", () => {
    const controller = createKCLController({
      itemCount: 2,
      activeIndex: 1,
      focused: true,
    });

    expect(controller.getCellContext(0, "alpha")).toEqual({
      id: "item-0",
      index: 0,
      data: "alpha",
      isCollectionFocused: true,
      isItemActive: false,
      isListFocused: true,
      isCellActive: false,
    });

    expect(controller.getCellContext(1, "beta")).toEqual({
      id: "item-1",
      index: 1,
      data: "beta",
      isCollectionFocused: true,
      isItemActive: true,
      isListFocused: true,
      isCellActive: true,
    });
  });

  it("reconciles active items by stable id when entries reorder", () => {
    const controller = createKCLController();

    controller.api.setRegisteredEntries([
      { id: "compose", element: null, data: undefined },
      { id: "inbox", element: null, data: undefined },
      { id: "labels", element: null, data: undefined },
    ]);
    controller.api.setActiveItemId("labels");

    expect(controller.getState()).toMatchObject({
      activeItemId: "labels",
      activeIndex: 2,
      itemIds: ["compose", "inbox", "labels"],
    });

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
    const controller = createKCLController({ wrapAround: true });

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

describe("KCL keymaps", () => {
  it("creates typed default shortcut values from the exported actions", () => {
    expect(createDefaultKCLShortcuts()).toEqual(
      Object.fromEntries(
        defaultKCLShortcutActions.map((action) => [
          action.id,
          action.defaultSequence,
        ]),
      ),
    );
  });

  it("creates default movement, activation, and edit bindings", () => {
    const activate = vi.fn();
    const edit = vi.fn();
    const keymap = createDefaultKCLKeymap<string>({
      onActivate: activate,
      onEdit: edit,
    });
    const resolved = resolveKCLKeymap(keymap);

    expect(createDefaultKCLShortcuts()).toMatchObject({
      activate: "Space",
      edit: "Enter",
    });
    expect(resolved).toHaveLength(8);
    expect(resolved[0]).toMatchObject({
      sequence: parseKeySequence("Up"),
      args: {
        kind: "command",
        command: "moveActive",
        args: { direction: "up" },
      },
    });
    expect(resolved[6]).toMatchObject({
      sequence: parseKeySequence("Space"),
      args: {
        kind: "cell",
        command: "activate",
        action: activate,
      },
    });
    expect(resolved[6]?.args).toEqual({
      kind: "cell",
      command: "activate",
      action: activate,
    });
    expect(resolved[7]?.args).toEqual({
      kind: "cell",
      command: "edit",
      action: edit,
    });
  });

  it("applies default KCL keymap overrides and omits invalid or empty bindings", () => {
    const activate = vi.fn();
    const resolved = resolveKCLKeymap(
      createDefaultKCLKeymap<string>({
        overrides: {
          "move-down": "J",
          "move-left": "Ctrl+",
          activate: "Ctrl+A",
          edit: "",
        },
        onActivate: activate,
      }),
    );

    expect(resolved).toHaveLength(6);
    expect(
      resolved.find(
        (binding) =>
          binding.args.kind === "command" &&
          binding.args.args?.direction === "down",
      ),
    ).toMatchObject({
      sequence: parseKeySequence("J"),
    });
    expect(
      resolved.some(
        (binding) =>
          binding.args.kind === "command" &&
          binding.args.args?.direction === "left",
      ),
    ).toBe(false);
    expect(
      resolved.find(
        (binding) =>
          binding.args.kind === "cell" && binding.args.command === "activate",
      ),
    ).toMatchObject({
      sequence: parseKeySequence("Ctrl-A"),
      args: {
        kind: "cell",
        command: "activate",
        action: activate,
      },
    });
    expect(
      resolved.some(
        (binding) =>
          binding.args.kind === "command" && binding.args.command === "edit",
      ),
    ).toBe(false);
  });

  it("applies collection keymap movement overrides and omits invalid or empty bindings", () => {
    const resolved = resolveKCLKeymap(
      createDefaultKCCollectionKeymap({
        overrides: {
          "move-up": "K",
          "move-down": "",
          "move-left": "Ctrl+",
          "move-right": "L",
          activate: "A",
          edit: "E",
        },
      }),
    );

    expect(resolved).toHaveLength(4);
    expect(
      resolved.find(
        (binding) =>
          binding.args.kind === "command" &&
          binding.args.args?.direction === "up",
      ),
    ).toMatchObject({
      sequence: parseKeySequence("K"),
    });
    expect(
      resolved.find(
        (binding) =>
          binding.args.kind === "command" &&
          binding.args.args?.direction === "right",
      ),
    ).toMatchObject({
      sequence: parseKeySequence("L"),
    });
    expect(
      resolved.some(
        (binding) =>
          binding.args.kind === "command" &&
          (binding.args.args?.direction === "down" ||
            binding.args.args?.direction === "left"),
      ),
    ).toBe(false);
    expect(
      resolved.some(
        (binding) =>
          binding.args.kind === "command" &&
          (binding.args.command === "activate" ||
            binding.args.command === "edit"),
      ),
    ).toBe(false);
  });

  it("drops invalid or empty shortcut bindings", () => {
    const resolved = resolveKCLKeymap([
      {
        sequence: "",
        action: "activate",
      },
      {
        sequence: "Ctrl+",
        action: "activate",
      },
      {
        sequence: "Enter",
        action: "activate",
      },
    ]);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.sequence).toEqual(parseKeySequence("Enter"));
  });

  it("creates action contexts for the current active data item", () => {
    const state: KCLControllerState = {
      activeItemId: "item-1",
      activeIndex: 1,
      itemCount: 2,
      itemIds: ["item-0", "item-1"],
      focused: true,
      orientation: "vertical",
      wrapAround: false,
    };

    expect(createKCLCellContext(state, ["alpha", "beta"])).toEqual({
      id: "item-1",
      index: 1,
      data: "beta",
      isCollectionFocused: true,
      isItemActive: true,
      isListFocused: true,
      isCellActive: true,
    });

    expect(createKCLCellContext({ ...state, activeIndex: -1 }, ["alpha"])).toBe(
      null,
    );
  });
});
