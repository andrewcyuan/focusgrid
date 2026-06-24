import { expect, test, type Locator } from "@playwright/test";

async function setTextareaSelection(
  textarea: Locator,
  selectionStart: number,
  selectionEnd: number,
) {
  await textarea.evaluate((element, selection) => {
    const textAreaElement = element as HTMLTextAreaElement;
    textAreaElement.setSelectionRange(selection.start, selection.end);
  }, { start: selectionStart, end: selectionEnd });
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
  await expect.poll(async () => {
    const alphaBox = await alphaPane.boundingBox();
    const betaBox = await betaPane.boundingBox();
    return (alphaBox?.x ?? 0) > (betaBox?.x ?? 0);
  }).toBe(true);
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

test("saved plus-style shortcuts are migrated before parsing", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "focusgrid.playground.shortcuts",
      JSON.stringify({
        "split-right": "Ctrl+B %",
      }),
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
  await expect.poll(async () => {
    const box = await alphaPane.boundingBox();
    return box?.width ?? 0;
  }).toBeGreaterThan(initialBox!.width);

  const postGrowthWidth = (await alphaPane.boundingBox())?.width ?? 0;

  await page.keyboard.press("H");
  await page.keyboard.press("H");

  await expect(alphaText).toHaveValue("abcdef");
  await expect.poll(async () => {
    const box = await alphaPane.boundingBox();
    return box?.width ?? 0;
  }).toBeLessThan(postGrowthWidth);
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
