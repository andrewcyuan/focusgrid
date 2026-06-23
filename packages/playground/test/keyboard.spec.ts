import { expect, test } from "@playwright/test";

test("pane shortcuts are handled before focused textareas edit text", async ({
  page,
}) => {
  await page.goto("/");

  const alphaText = page.locator('[data-pane-id="alpha"] textarea');
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await alphaText.evaluate((element) => {
    element.setSelectionRange(3, 3);
  });

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(page.locator(".TextPane")).toHaveCount(3);
});

test("invalid shortcut continuations are no-opped instead of typed", async ({
  page,
}) => {
  await page.goto("/");

  const alphaText = page.locator('[data-pane-id="alpha"] textarea');
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await alphaText.evaluate((element) => {
    element.setSelectionRange(3, 3);
  });

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
  await alphaText.evaluate((element) => {
    element.setSelectionRange(3, 3);
  });

  await page.keyboard.press("Control+B");
  await page.keyboard.press("Shift+5");

  await expect(alphaText).toHaveValue("abcdef");
  await expect(page.locator(".TextPane")).toHaveCount(3);
});

test("repeatable followers run without replaying the leader", async ({ page }) => {
  await page.goto("/");

  const alphaPane = page.locator('[data-pane-id="alpha"]');
  const alphaText = alphaPane.locator("textarea");
  await expect(alphaText).toBeFocused();

  await alphaText.fill("abcdef");
  await alphaText.evaluate((element) => {
    element.setSelectionRange(3, 3);
  });

  const initialBox = await alphaPane.boundingBox();
  expect(initialBox).not.toBeNull();

  await page.keyboard.press("Control+B");
  await page.keyboard.press("L");
  await page.keyboard.press("L");
  await page.keyboard.press("L");

  await expect(alphaText).toHaveValue("abcdef");
  await expect
    .poll(async () => (await alphaPane.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialBox!.width);
});
