import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  KCCollection,
  KCItem,
  KCList,
  createKCController,
  useKCController,
  useKCControllerState,
  type KCActionContext,
} from "../src";

describe("KC React bindings", () => {
  it("passes KC action context to list rows", () => {
    const controller = createKCController({
      itemIds: ["alpha", "beta"],
      activeItemId: "beta",
      focused: true,
    });
    const contexts: Array<KCActionContext<string>> = [];

    const markup = renderToStaticMarkup(
      <KCCollection controller={controller} keymap={[]} direction="vertical">
        <KCList
          dataList={["alpha", "beta"]}
          getItemId={(item) => item}
          renderCell={(ctx) => {
            contexts.push(ctx);
            return <span>{ctx.data}</span>;
          }}
        />
      </KCCollection>
    );

    expect(markup).toContain("<span>alpha</span>");
    expect(markup).toContain("<span>beta</span>");
    expect(contexts).toEqual([
      {
        id: "alpha",
        index: 0,
        data: "alpha",
        isCollectionFocused: true,
        isItemActive: false,
      },
      {
        id: "beta",
        index: 1,
        data: "beta",
        isCollectionFocused: true,
        isItemActive: true,
      },
    ]);
  });

  it("renders collection items, lists, and static children in one surface", () => {
    const controller = createKCController({
      itemIds: ["compose", "inbox-primary", "labels-more"],
      activeItemId: "inbox-primary",
      focused: true,
    });

    const markup = renderToStaticMarkup(
      <KCCollection controller={controller} keymap={[]} direction="vertical">
        <h2>Mail</h2>
        <KCItem id="compose">Compose</KCItem>
        <KCList
          dataList={[{ id: "primary", label: "Primary" }]}
          getItemId={(item) => `inbox-${item.id}`}
          renderCell={(ctx) => ctx.data.label}
        />
        <KCItem id="labels-more">More</KCItem>
      </KCCollection>
    );

    expect(markup).toContain("<h2>Mail</h2>");
    expect(markup).toContain('data-kc-item-id="compose"');
    expect(markup).toContain('data-kc-item-id="inbox-primary"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('data-kc-item-id="labels-more"');
  });

  it("creates a stable controller with useKCController", () => {
    let controllerFromHook: ReturnType<typeof createKCController> | null = null;

    function TestApp() {
      const controller = useKCController({
        itemIds: ["a", "b", "c"],
        activeItemId: "c",
      });
      controllerFromHook = controller;

      return (
        <KCCollection controller={controller} keymap={[]} direction="vertical">
          <KCList
            dataList={["a", "b", "c"]}
            getItemId={(item) => item}
            renderCell={(ctx) => ctx.data}
          />
        </KCCollection>
      );
    }

    renderToStaticMarkup(<TestApp />);

    expect(controllerFromHook?.getState().activeItemId).toBe("c");
  });

  it("reads controller state from the hook", () => {
    const controller = createKCController({ itemIds: ["a"] });
    let activeIndex: number | undefined;

    function TestApp() {
      activeIndex = useKCControllerState(controller).activeIndex;
      return null;
    }

    renderToStaticMarkup(<TestApp />);

    expect(activeIndex).toBe(0);
  });
});
