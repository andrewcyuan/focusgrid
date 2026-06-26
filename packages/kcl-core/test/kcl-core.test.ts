import { describe, expect, it, vi } from "vitest";
import {
  createDefaultKCLKeymap,
  createDefaultKCLShortcuts,
  createKCLCellContext,
  createKCLController,
  parseKeySequence,
  resolveKCLKeymap,
  type KCLControllerState,
} from "../src";

describe("KCLController", () => {
  it("initializes empty and non-empty lists deterministically", () => {
    expect(createKCLController().getState()).toEqual({
      activeIndex: -1,
      itemCount: 0,
      focused: false,
      orientation: "vertical",
    });

    expect(
      createKCLController({
        itemCount: 5,
        selectDefaultIndex: () => 2,
        focused: true,
        orientation: "horizontal",
      }).getState(),
    ).toEqual({
      activeIndex: 2,
      itemCount: 5,
      focused: true,
      orientation: "horizontal",
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
      index: 0,
      data: "alpha",
      isListFocused: true,
      isCellActive: false,
    });

    expect(controller.getCellContext(1, "beta")).toEqual({
      index: 1,
      data: "beta",
      isListFocused: true,
      isCellActive: true,
    });
  });
});

describe("KCL keymaps", () => {
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
      activeIndex: 1,
      itemCount: 2,
      focused: true,
      orientation: "vertical",
    };

    expect(createKCLCellContext(state, ["alpha", "beta"])).toEqual({
      index: 1,
      data: "beta",
      isListFocused: true,
      isCellActive: true,
    });

    expect(createKCLCellContext({ ...state, activeIndex: -1 }, ["alpha"])).toBe(
      null,
    );
  });
});
