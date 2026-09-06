import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  parseKeySequence,
  type ShortcutBinding,
} from "@focusgrid/shortcut-engine";
import {
  createCompositeNavigationKeymap,
  normalizeCompositeNavigationShortcutOverrides,
  useCompositeShortcutRouter,
  type CompositeShortcutRouterResult,
} from "../src/react";

type TestEventInit = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  defaultPrevented?: boolean;
  target?: EventTarget | null;
};

function renderHookResult<
  TContext = undefined,
  TAction extends string = string,
  TArgs = unknown,
>(
  options: Parameters<
    typeof useCompositeShortcutRouter<TContext, TAction, TArgs>
  >[0],
): CompositeShortcutRouterResult {
  let result: CompositeShortcutRouterResult | null = null;

  function TestComponent() {
    result = useCompositeShortcutRouter(options);
    return <div {...result.compositeProps} />;
  }

  renderToStaticMarkup(<TestComponent />);

  if (!result) {
    throw new Error("Hook did not render.");
  }

  return result;
}

function sendKey(
  result: CompositeShortcutRouterResult,
  init: TestEventInit,
): KeyboardEvent {
  const event = {
    key: init.key,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: init.altKey ?? false,
    shiftKey: init.shiftKey ?? false,
    defaultPrevented: init.defaultPrevented ?? false,
    target: init.target ?? null,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;

  result.onKeyDownCapture({
    nativeEvent: event,
  } as React.KeyboardEvent<HTMLElement>);

  return event;
}

describe("useCompositeShortcutRouter", () => {
  it("routes mapped navigation shortcuts through shortcut-engine", () => {
    const onMatch = vi.fn();
    const result = renderHookResult({
      keymap: createCompositeNavigationKeymap({
        overrides: {
          "move-down": "J",
        },
      }),
      onMatch,
    });

    sendKey(result, { key: "j" });

    expect(onMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "move-down",
        args: { direction: "down" },
      }),
    );
  });

  it("prevents default and stops propagation for matched events", () => {
    const result = renderHookResult({
      keymap: createCompositeNavigationKeymap({
        overrides: {
          "move-right": "L",
        },
      }),
      onMatch: vi.fn(),
    });

    const event = sendKey(result, { key: "l" });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });

  it.each([
    ["textarea", { tagName: "TEXTAREA" }, true],
    ["disabled textarea", { tagName: "TEXTAREA", disabled: true }, false],
    ["text input", { tagName: "INPUT", type: "text" }, true],
    ["readonly input", { tagName: "INPUT", type: "text", readOnly: true }, false],
    ["checkbox", { tagName: "INPUT", type: "checkbox" }, false],
    ["contenteditable", { tagName: "DIV", isContentEditable: true }, true],
    [
      "textbox role",
      { tagName: "DIV", getAttribute: (name: string) => name === "role" ? "TEXTBOX" : null },
      true,
    ],
  ] as const)("uses shared editable behavior for %s", (_, target, editable) => {
    const onMatch = vi.fn();
    const result = renderHookResult({
      keymap: createCompositeNavigationKeymap({
        overrides: {
          "move-down": "J",
        },
      }),
      onMatch,
    });

    const event = sendKey(result, {
      key: "j",
      target: target as unknown as EventTarget,
    });

    expect(onMatch).toHaveBeenCalledTimes(editable ? 0 : 1);
    expect(event.preventDefault).toHaveBeenCalledTimes(editable ? 0 : 1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(editable ? 0 : 1);
  });

  it("resets pending multi-stroke state for ignored events", () => {
    const onMatch = vi.fn();
    const keymap: ShortcutBinding<undefined, "open">[] = [
      {
        sequence: parseKeySequence("Ctrl-K O"),
        action: "open",
      },
    ];
    const result = renderHookResult({
      keymap,
      onMatch,
    });

    sendKey(result, { key: "k", ctrlKey: true });
    sendKey(result, {
      key: "x",
      target: { tagName: "INPUT" } as unknown as EventTarget,
    });
    const event = sendKey(result, { key: "o" });

    expect(onMatch).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  it("omits invalid and empty shortcut overrides", () => {
    const normalized = normalizeCompositeNavigationShortcutOverrides({
      "move-left": "",
      "move-right": "Ctrl+",
      "move-down": "Ctrl+J",
    });
    const keymap = createCompositeNavigationKeymap({
      overrides: {
        "move-left": "",
        "move-right": "Ctrl+",
        "move-down": "Ctrl+J",
      },
    });

    expect(normalized).toEqual({
      "move-down": "Ctrl-J",
    });
    expect(keymap.map((binding) => binding.action)).not.toContain("move-left");
    expect(keymap.map((binding) => binding.action)).not.toContain("move-right");
    expect(keymap).toContainEqual(
      expect.objectContaining({
        action: "move-down",
      }),
    );
  });

  it("returns composite props with the capture handler and marker", () => {
    const result = renderHookResult({
      keymap: [],
      onMatch: vi.fn(),
    });

    expect(result.compositeProps).toEqual({
      "data-focusgrid-composite": "",
      onKeyDownCapture: result.onKeyDownCapture,
    });
  });
});
