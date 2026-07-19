import { expect, test, type Locator } from "@playwright/test";

async function setTextareaSelection(
  textarea: Locator,
  selectionStart: number,
  selectionEnd: number
) {
  await textarea.evaluate(
    (element, selection) => {
      const textAreaElement = element as HTMLTextAreaElement;
      textAreaElement.setSelectionRange(selection.start, selection.end);
    },
    { start: selectionStart, end: selectionEnd }
  );
}

test("pane shortcuts are handled before focused textareas edit text", async ({
  page,
}) => {
  await page.goto("/");

  const alphaText = page.locator('[data-pane-id="alpha"] textarea');
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(page.locator(".TextPane")).toHaveCount(3);
});

test("clicking non-focusable pane content focuses the pane shell for shortcuts", async ({
  page,
}) => {
  await page.goto("/");

  const alphaPane = page.locator('[data-pane-id="alpha"]');
  const alphaText = alphaPane.locator("textarea");
  await expect(alphaText).toBeFocused();

  await alphaPane.locator(".TextPaneHeader").click();

  await expect(alphaPane).toBeFocused();

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(page.locator(".TextPane")).toHaveCount(3);
});

test("pane shortcuts stay scoped to the focused FocusGrid subtree", async ({
  page,
}) => {
  await page.goto("/");

  const splitRightShortcut = page.getByLabel("Split right");
  await splitRightShortcut.focus();
  await expect(splitRightShortcut).toBeFocused();

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(page.locator(".TextPane")).toHaveCount(2);
  await expect(splitRightShortcut).toBeFocused();
});

test("directional swap shortcuts move the active pane from a focused textarea", async ({
  page,
}) => {
  await page.goto("/");

  const alphaPane = page.locator('[data-pane-id="alpha"]');
  const betaPane = page.locator('[data-pane-id="beta"]');
  const alphaText = alphaPane.locator("textarea");
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  const initialAlphaBox = await alphaPane.boundingBox();
  const initialBetaBox = await betaPane.boundingBox();
  expect(initialAlphaBox).not.toBeNull();
  expect(initialBetaBox).not.toBeNull();
  expect(initialAlphaBox!.x).toBeLessThan(initialBetaBox!.x);

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+ArrowRight");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(alphaText).toBeFocused();
  await expect(alphaPane).toHaveAttribute("data-active", "true");
  await expect
    .poll(async () => {
      const alphaBox = await alphaPane.boundingBox();
      const betaBox = await betaPane.boundingBox();
      return (alphaBox?.x ?? 0) > (betaBox?.x ?? 0);
    })
    .toBe(true);
});

test("invalid shortcut continuations are no-opped instead of typed", async ({
  page,
}) => {
  await page.goto("/");

  const alphaText = page.locator('[data-pane-id="alpha"] textarea');
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Z");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(page.locator(".TextPane")).toHaveCount(2);

  await page.keyboard.press("Z");
  await expect(alphaText).toHaveValue("abcZdef");
});

test("saved plus-style shortcuts are migrated before parsing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "focusgrid.playground.shortcuts",
      JSON.stringify({
        "split-right": "Ctrl+B %",
      })
    );
  });

  await page.goto("/");

  const alphaText = page.locator('[data-pane-id="alpha"] textarea');
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(page.locator(".TextPane")).toHaveCount(3);
});

test("repeatable leader followers run without replaying the leader", async ({
  page,
}) => {
  await page.goto("/");

  const alphaPane = page.locator('[data-pane-id="alpha"]');
  const alphaText = alphaPane.locator("textarea");
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await setTextareaSelection(alphaText, 3, 3);

  const initialBox = await alphaPane.boundingBox();
  expect(initialBox).not.toBeNull();

  await page.keyboard.press("Control+B");
  await page.keyboard.press("L");
  await page.keyboard.press("L");
  await page.keyboard.press("L");

  await expect(alphaText).toHaveValue("abcdef");
  await expect
    .poll(async () => {
      const box = await alphaPane.boundingBox();
      return box?.width ?? 0;
    })
    .toBeGreaterThan(initialBox!.width);

  const postGrowthWidth = (await alphaPane.boundingBox())?.width ?? 0;

  await page.keyboard.press("H");
  await page.keyboard.press("H");

  await expect(alphaText).toHaveValue("abcdef");
  await expect
    .poll(async () => {
      const box = await alphaPane.boundingBox();
      return box?.width ?? 0;
    })
    .toBeLessThan(postGrowthWidth);
});

test("horizontal pointer resize continues after dragging outside the handle", async ({
  page,
}) => {
  await page.goto("/");

  const alphaPane = page.locator('[data-pane-id="alpha"]');
  const resizeHandle = page
    .locator('.FocusgridResizeHandle[data-direction="horizontal"]')
    .first();

  await expect(resizeHandle).toBeVisible();

  const initialBox = await alphaPane.boundingBox();
  const handleBox = await resizeHandle.boundingBox();
  expect(initialBox).not.toBeNull();
  expect(handleBox).not.toBeNull();

  const startX = handleBox!.x + handleBox!.width / 2;
  const startY = handleBox!.y + handleBox!.height / 2;
  const dragDistance = Math.max(120, handleBox!.width * 20);

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  for (const step of [0.2, 0.45, 0.7, 1]) {
    await page.mouse.move(startX + dragDistance * step, startY, { steps: 4 });
  }

  await page.mouse.up();

  await expect
    .poll(async () => (await alphaPane.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialBox!.width + 80);
});

test("Ariakit composite loads focused inside a Focusgrid pane", async ({
  page,
}) => {
  await page.goto("/aria-kit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');

  await expect(page.locator(".AriakitPane")).toHaveCount(2);
  await expect(leftPane).toHaveAttribute(
    "data-active",
    "true",
  );
  await expect(leftPane.locator('[data-row-id="alpha"]')).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Focusgrid playground" }),
  ).toBeVisible();
});

test("Ariakit arrow keys and adapter shortcuts move DOM focus", async ({
  page,
}) => {
  await page.goto("/aria-kit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const alpha = leftPane.locator('[data-row-id="alpha"]');
  const beta = leftPane.locator('[data-row-id="beta"]');
  const gamma = leftPane.locator('[data-row-id="gamma"]');
  const delta = leftPane.locator('[data-row-id="delta"]');

  await expect(alpha).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(beta).toBeFocused();
  await page.keyboard.press("J");
  await expect(gamma).toBeFocused();
  await page.keyboard.press("K");
  await expect(beta).toBeFocused();
  await page.keyboard.press("L");
  await expect(gamma).toBeFocused();
  await page.keyboard.press("H");
  await expect(beta).toBeFocused();
  await page.keyboard.press("Shift+G");
  await expect(delta).toBeFocused();
  await page.keyboard.press("G");
  await page.keyboard.press("G");
  await expect(alpha).toBeFocused();
});

test("Ariakit adapter actions use the active row and prevent default", async ({
  page,
}) => {
  await page.goto("/aria-kit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');

  await expect(leftPane.locator('[data-row-id="alpha"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(leftPane.locator('[data-row-id="beta"]')).toBeFocused();
  await page.keyboard.press("Space");

  const status = leftPane.locator(".AriakitActionStatus");
  await expect(status).toHaveText("Space on Beta");
  await expect(status).toHaveAttribute("data-default-prevented", "true");
  await expect(leftPane.locator('[data-row-id="beta"]')).toBeFocused();
});

test("Ariakit adapter ignores typing in the embedded input", async ({ page }) => {
  await page.goto("/aria-kit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const input = leftPane.getByRole("textbox", { name: "Editable input" });
  await input.focus();
  await page.keyboard.type("j k g g ");

  await expect(input).toHaveValue("j k g g ");
  await expect(input).toBeFocused();
  await expect(leftPane.locator(".AriakitActionStatus")).toHaveText(
    "No row action yet",
  );
});

test("Focusgrid pane shortcuts transfer focus between Ariakit composites", async ({
  page,
}) => {
  await page.goto("/aria-kit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const rightPane = page.locator('[data-pane-id="ariakit-beta"]');
  const leftBeta = leftPane.locator('[data-row-id="beta"]');
  const rightAlpha = rightPane.locator('[data-row-id="alpha"]');
  const rightBeta = rightPane.locator('[data-row-id="beta"]');

  await expect(leftPane.locator('[data-row-id="alpha"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(leftBeta).toBeFocused();
  await expect(leftBeta).toHaveCSS("background-color", "rgb(237, 244, 255)");

  await page.keyboard.press("Control+B");
  await page.keyboard.press("ArrowRight");

  await expect(rightPane).toHaveAttribute("data-active", "true");
  await expect(rightAlpha).toBeFocused();
  await expect(leftBeta).toHaveAttribute("data-active-item", "true");
  await expect(leftBeta).toHaveCSS("background-color", "rgb(228, 232, 238)");
  await expect(rightAlpha).toHaveCSS(
    "background-color",
    "rgb(237, 244, 255)",
  );
  await page.keyboard.press("ArrowDown");
  await expect(rightBeta).toBeFocused();

  await page.keyboard.press("Control+B");
  await page.keyboard.press("ArrowLeft");

  await expect(leftPane).toHaveAttribute("data-active", "true");
  await expect(leftBeta).toBeFocused();
  await expect(leftBeta).toHaveCSS("background-color", "rgb(237, 244, 255)");

  await page.keyboard.press("Control+B");
  await page.keyboard.press("ArrowRight");
  await expect(rightBeta).toBeFocused();
});

test("static Ariakit header clicks restore the active pane", async ({ page }) => {
  await page.goto("/aria-kit");

  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const beta = leftPane.locator('[data-row-id="beta"]');
  await expect(leftPane.locator('[data-row-id="alpha"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(beta).toBeFocused();

  await page.locator(".AriakitPageHeader h1").click();
  await expect(beta).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(leftPane.locator('[data-row-id="gamma"]')).toBeFocused();
});

test("window reactivation restores unowned Ariakit focus", async ({
  page,
  context,
}) => {
  await page.goto("/aria-kit");
  const leftPane = page.locator('[data-pane-id="ariakit-alpha"]');
  const beta = leftPane.locator('[data-row-id="beta"]');
  await expect(leftPane.locator('[data-row-id="alpha"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(beta).toBeFocused();
  await beta.evaluate((element) => element.blur());

  const otherPage = await context.newPage();
  await otherPage.goto("about:blank");
  await otherPage.bringToFront();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new FocusEvent("focus")));

  await expect(beta).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(leftPane.locator('[data-row-id="gamma"]')).toBeFocused();
  await otherPage.close();
});

test("window reactivation preserves interactive Ariakit header controls", async ({
  page,
  context,
}) => {
  await page.goto("/aria-kit");
  const toolbarLink = page.getByRole("link", { name: "Focusgrid playground" });
  await toolbarLink.focus();

  const otherPage = await context.newPage();
  await otherPage.goto("about:blank");
  await otherPage.bringToFront();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new FocusEvent("focus")));

  await expect(toolbarLink).toBeFocused();
  await otherPage.close();
});
