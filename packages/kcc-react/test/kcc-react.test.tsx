import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  KeyboardControlledList,
  createDefaultKCLKeymap,
  createKCLController,
  useKCLController,
  useKCLControllerState,
  type KCLCellContext,
} from "../src";

describe("KeyboardControlledList", () => {
  it("passes KCL cell context to renderCell", () => {
    const controller = createKCLController({
      itemCount: 2,
      activeIndex: 1,
      focused: true,
    });
    const contexts: Array<KCLCellContext<string>> = [];

    const markup = renderToStaticMarkup(
      <KeyboardControlledList
        controller={controller}
        keymap={createDefaultKCLKeymap()}
        direction="vertical"
        dataList={["alpha", "beta"]}
        renderCell={(ctx) => {
          contexts.push(ctx);
          return <span>{ctx.data}</span>;
        }}
      />,
    );

    expect(markup).toContain("<span>alpha</span>");
    expect(markup).toContain("<span>beta</span>");
    expect(contexts).toEqual([
      {
        index: 0,
        data: "alpha",
        isListFocused: true,
        isCellActive: false,
      },
      {
        index: 1,
        data: "beta",
        isListFocused: true,
        isCellActive: true,
      },
    ]);
  });

  it("renders row roles and active data attributes before DOM effects mount", () => {
    const controller = createKCLController({ itemCount: 2, activeIndex: 0 });

    const markup = renderToStaticMarkup(
      <KeyboardControlledList
        controller={controller}
        keymap={[]}
        direction="vertical"
        dataList={["alpha", "beta"]}
        renderCell={(ctx) => ctx.data}
      />,
    );

    expect(markup).toContain('role="option"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('data-kcl-row-index="0"');
    expect(markup).toContain('data-active="true"');
  });

  it("creates a stable controller with useKCLController", () => {
    let controllerFromHook: ReturnType<typeof createKCLController> | null = null;

    function TestApp() {
      const controller = useKCLController({ itemCount: 3, activeIndex: 2 });
      controllerFromHook = controller;

      return (
        <KeyboardControlledList
          controller={controller}
          keymap={[]}
          direction="vertical"
          dataList={["a", "b", "c"]}
          renderCell={(ctx) => ctx.data}
        />
      );
    }

    renderToStaticMarkup(<TestApp />);

    expect(controllerFromHook?.getState().activeIndex).toBe(2);
  });

  it("reads controller state from the hook", () => {
    const controller = createKCLController({ itemCount: 1 });
    let activeIndex: number | undefined;

    function TestApp() {
      activeIndex = useKCLControllerState(controller).activeIndex;
      return null;
    }

    renderToStaticMarkup(<TestApp />);

    expect(activeIndex).toBe(0);
  });
});
